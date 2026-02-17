"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Code2,
  FileCode,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  ExternalLink,
  Minus,
  Plus,
} from "lucide-react";
import { codeToHtml } from "shiki";
import type { ICTTStep, TokenType } from "@/components/toolbox/stores/icttSetupStore";

interface CodeConfig {
  title: string;
  filename: string;
  sourceUrl: string;
  githubUrl: string;
  highlightFunctions: string[];
  description: string;
}

const CODE_CONFIGS: Record<ICTTStep, (tokenType: TokenType) => CodeConfig> = {
  "select-token": () => ({
    title: "Source Token Contract",
    filename: "IERC20.sol",
    sourceUrl: "https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/master/contracts/token/ERC20/IERC20.sol",
    githubUrl: "https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/IERC20.sol",
    highlightFunctions: ["balanceOf", "transfer", "approve"],
    description: "Standard ERC20 interface that your token must implement",
  }),
  "deploy-home": (tokenType) => ({
    title: tokenType === "erc20" ? "ERC20 Token Home" : "Native Token Home",
    filename: tokenType === "erc20" ? "ERC20TokenHome.sol" : "NativeTokenHome.sol",
    sourceUrl: tokenType === "erc20"
      ? "https://raw.githubusercontent.com/ava-labs/icm-contracts/main/contracts/ictt/TokenHome/ERC20TokenHome.sol"
      : "https://raw.githubusercontent.com/ava-labs/icm-contracts/main/contracts/ictt/TokenHome/NativeTokenHome.sol",
    githubUrl: tokenType === "erc20"
      ? "https://github.com/ava-labs/icm-contracts/blob/main/contracts/ictt/TokenHome/ERC20TokenHome.sol"
      : "https://github.com/ava-labs/icm-contracts/blob/main/contracts/ictt/TokenHome/NativeTokenHome.sol",
    highlightFunctions: ["constructor", "_send", "_addCollateral"],
    description: "Locks source tokens as collateral for cross-chain transfers",
  }),
  "deploy-remote": (tokenType) => ({
    title: tokenType === "erc20" ? "ERC20 Token Remote" : "Native Token Remote",
    filename: tokenType === "erc20" ? "ERC20TokenRemote.sol" : "NativeTokenRemote.sol",
    sourceUrl: tokenType === "erc20"
      ? "https://raw.githubusercontent.com/ava-labs/icm-contracts/main/contracts/ictt/TokenRemote/ERC20TokenRemote.sol"
      : "https://raw.githubusercontent.com/ava-labs/icm-contracts/main/contracts/ictt/TokenRemote/NativeTokenRemote.sol",
    githubUrl: tokenType === "erc20"
      ? "https://github.com/ava-labs/icm-contracts/blob/main/contracts/ictt/TokenRemote/ERC20TokenRemote.sol"
      : "https://github.com/ava-labs/icm-contracts/blob/main/contracts/ictt/TokenRemote/NativeTokenRemote.sol",
    highlightFunctions: ["constructor", "_send", "_registerWithHome"],
    description: "Mints/burns token representations on the destination chain",
  }),
  "register": (tokenType) => ({
    title: "Registration Function",
    filename: tokenType === "erc20" ? "ERC20TokenRemote.sol" : "NativeTokenRemote.sol",
    sourceUrl: tokenType === "erc20"
      ? "https://raw.githubusercontent.com/ava-labs/icm-contracts/main/contracts/ictt/TokenRemote/ERC20TokenRemote.sol"
      : "https://raw.githubusercontent.com/ava-labs/icm-contracts/main/contracts/ictt/TokenRemote/NativeTokenRemote.sol",
    githubUrl: tokenType === "erc20"
      ? "https://github.com/ava-labs/icm-contracts/blob/main/contracts/ictt/TokenRemote/ERC20TokenRemote.sol"
      : "https://github.com/ava-labs/icm-contracts/blob/main/contracts/ictt/TokenRemote/NativeTokenRemote.sol",
    highlightFunctions: ["registerWithHome", "_registerWithHome"],
    description: "Links the Remote to its Home via Avalanche ICM",
  }),
  "collateral": (tokenType) => ({
    title: "Collateral Function",
    filename: tokenType === "erc20" ? "ERC20TokenHome.sol" : "NativeTokenHome.sol",
    sourceUrl: tokenType === "erc20"
      ? "https://raw.githubusercontent.com/ava-labs/icm-contracts/main/contracts/ictt/TokenHome/ERC20TokenHome.sol"
      : "https://raw.githubusercontent.com/ava-labs/icm-contracts/main/contracts/ictt/TokenHome/NativeTokenHome.sol",
    githubUrl: tokenType === "erc20"
      ? "https://github.com/ava-labs/icm-contracts/blob/main/contracts/ictt/TokenHome/ERC20TokenHome.sol"
      : "https://github.com/ava-labs/icm-contracts/blob/main/contracts/ictt/TokenHome/NativeTokenHome.sol",
    highlightFunctions: ["addCollateral", "_addCollateral"],
    description: "Deposits tokens to back initial remote allocations",
  }),
};

const FONT_SIZES = [10, 11, 12, 13, 14] as const;
type FontSize = (typeof FONT_SIZES)[number];

interface ICTTCodeViewerProps {
  currentStep: ICTTStep;
  tokenType: TokenType;
  expanded: boolean;
  onToggle: () => void;
}

export function ICTTCodeViewer({
  currentStep,
  tokenType,
  expanded,
  onToggle,
}: ICTTCodeViewerProps) {
  const [code, setCode] = useState<string>("");
  const [highlightedCode, setHighlightedCode] = useState<{ light: string; dark: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>(11);
  const [isDark, setIsDark] = useState(false);

  const config = CODE_CONFIGS[currentStep](tokenType);

  // Detect dark mode
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Load saved font size
  useEffect(() => {
    const saved = localStorage.getItem("ictt-code-font-size");
    if (saved && FONT_SIZES.includes(Number(saved) as FontSize)) {
      setFontSize(Number(saved) as FontSize);
    }
  }, []);

  // Fetch and highlight code
  useEffect(() => {
    if (!expanded) return;

    const fetchCode = async () => {
      setLoading(true);
      try {
        const response = await fetch(config.sourceUrl);
        const text = await response.text();

        // Extract relevant functions if specified
        let displayCode = text;
        if (config.highlightFunctions.length > 0) {
          const extracted = extractFunctions(text, config.highlightFunctions);
          if (extracted) {
            displayCode = extracted;
          }
        }

        setCode(displayCode);

        // Highlight with Shiki
        const [light, dark] = await Promise.all([
          codeToHtml(displayCode, { lang: "solidity", theme: "github-light" }),
          codeToHtml(displayCode, { lang: "solidity", theme: "github-dark" }),
        ]);
        setHighlightedCode({ light, dark });
      } catch (error) {
        console.error("Failed to fetch code:", error);
        setCode("// Failed to load source code");
      } finally {
        setLoading(false);
      }
    };

    fetchCode();
  }, [config.sourceUrl, config.highlightFunctions.join(","), expanded]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const adjustFontSize = useCallback((delta: number) => {
    setFontSize((prev) => {
      const idx = FONT_SIZES.indexOf(prev);
      const newIdx = Math.max(0, Math.min(FONT_SIZES.length - 1, idx + delta));
      const newSize = FONT_SIZES[newIdx];
      localStorage.setItem("ictt-code-font-size", String(newSize));
      return newSize;
    });
  }, []);

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <FileCode className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {config.title}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {config.description}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-xs text-zinc-400 font-mono">
            {config.filename}
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-zinc-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-400" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <>
          {/* Toolbar */}
          <div className="px-4 py-2 border-t border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/30">
            <div className="flex items-center gap-2">
              <span
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
              >
                Solidity
              </span>
              {config.highlightFunctions.length > 0 && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Showing: {config.highlightFunctions.join(", ")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* Font size controls */}
              <div className="flex items-center gap-0.5 px-1 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 mr-2">
                <button
                  onClick={() => adjustFontSize(-1)}
                  disabled={fontSize === FONT_SIZES[0]}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 disabled:opacity-30"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-[10px] font-mono text-zinc-500 w-5 text-center">
                  {fontSize}
                </span>
                <button
                  onClick={() => adjustFontSize(1)}
                  disabled={fontSize === FONT_SIZES[FONT_SIZES.length - 1]}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 disabled:opacity-30"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
              <a
                href={config.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Code Content */}
          <div className="overflow-auto max-h-[400px]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-3 text-zinc-500">
                  <div className="w-4 h-4 border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-600 dark:border-t-zinc-300 rounded-full animate-spin" />
                  <span className="text-sm">Loading source...</span>
                </div>
              </div>
            ) : (
              <div
                className="py-4 px-4 font-mono shiki-container"
                style={{ fontSize: `${fontSize}px`, lineHeight: 1.6 }}
              >
                {highlightedCode ? (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: isDark ? highlightedCode.dark : highlightedCode.light,
                    }}
                  />
                ) : (
                  <pre className="text-zinc-600 dark:text-zinc-400">{code}</pre>
                )}
              </div>
            )}
          </div>
        </>
      )}

      <style jsx global>{`
        .shiki-container pre {
          background: transparent !important;
          margin: 0;
          padding: 0;
        }
        .shiki-container code {
          display: block;
        }
      `}</style>
    </div>
  );
}

// Helper to extract specific functions from Solidity source
function extractFunctions(source: string, functionNames: string[]): string | null {
  const lines = source.split("\n");
  const blocks: string[] = [];

  for (const funcName of functionNames) {
    const funcPattern = new RegExp(`function\\s+${funcName}\\s*[(<]`);
    let startLine = -1;
    let braceCount = 0;
    let inBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!inBlock && funcPattern.test(line)) {
        startLine = i;
        inBlock = true;
        braceCount = 0;
      }

      if (inBlock) {
        for (const char of line) {
          if (char === "{") braceCount++;
          if (char === "}") braceCount--;
        }

        if (braceCount === 0 && line.includes("}")) {
          // Include 1 line of context before
          const start = Math.max(0, startLine - 1);
          blocks.push(lines.slice(start, i + 1).join("\n"));
          inBlock = false;
          break;
        }
      }
    }
  }

  if (blocks.length > 0) {
    return blocks.join("\n\n// ...\n\n");
  }

  return null;
}

export default ICTTCodeViewer;
