"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { codeToHtml } from "shiki";
import { Copy, Check, ExternalLink, Minus, Plus, FileCode, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import versions from "@/scripts/versions.json";

// Precompile interface file mapping
const PRECOMPILE_INTERFACES: Record<string, { file: string; functions: string[] }> = {
  FeeManager: {
    file: "contracts/precompile/contracts/feemanager/IFeeManager.sol",
    functions: ["setFeeConfig", "getFeeConfig", "getFeeConfigLastChangedAt"],
  },
  NativeMinter: {
    file: "contracts/precompile/contracts/nativeminter/INativeMinter.sol",
    functions: ["mintNativeCoin"],
  },
  RewardManager: {
    file: "contracts/precompile/contracts/rewardmanager/IRewardManager.sol",
    functions: ["allowFeeRecipients", "setRewardAddress", "disableRewards", "areFeeRecipientsAllowed", "currentRewardAddress"],
  },
  AllowList: {
    file: "contracts/precompile/contracts/IAllowList.sol",
    functions: ["setAdmin", "setManager", "setEnabled", "setNone", "readAllowList"],
  },
  ContractDeployerAllowList: {
    file: "contracts/precompile/contracts/deployerallowlist/IContractDeployerAllowList.sol",
    functions: ["setAdmin", "setManager", "setEnabled", "setNone", "readAllowList"],
  },
  TxAllowList: {
    file: "contracts/precompile/contracts/txallowlist/ITxAllowList.sol",
    functions: ["setAdmin", "setManager", "setEnabled", "setNone", "readAllowList"],
  },
};

const FONT_SIZES = [10, 11, 12, 13, 14] as const;
type FontSize = (typeof FONT_SIZES)[number];
const DEFAULT_FONT_SIZE: FontSize = 11;

function extractFunctionBlock(source: string, name: string, contextLines: number = 1): string | null {
  const lines = source.split("\n");
  const funcPatterns = [
    new RegExp(`function\\s+${name}\\s*\\(`),
    new RegExp(`function\\s+${name}\\s*<`),
  ];
  const structPattern = new RegExp(`struct\\s+${name}\\s*\\{`);

  let startLine = -1;
  let braceCount = 0;
  let inBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inBlock && (funcPatterns.some((p) => p.test(line)) || structPattern.test(line))) {
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
        const start = Math.max(0, startLine - contextLines);
        const end = Math.min(lines.length - 1, i + contextLines);
        return lines.slice(start, end + 1).join("\n");
      }
    }
  }

  // For interface function declarations that end with ;
  if (startLine === -1) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (funcPatterns.some((p) => p.test(line))) {
        // Find the end of the declaration (either ; or {)
        let endLine = i;
        for (let j = i; j < lines.length; j++) {
          if (lines[j].includes(";") || lines[j].includes("{")) {
            endLine = j;
            break;
          }
        }
        const start = Math.max(0, i - contextLines);
        const end = Math.min(lines.length - 1, endLine + contextLines);
        return lines.slice(start, end + 1).join("\n");
      }
    }
  }

  return null;
}

function findStructInSignature(source: string, functionName: string): string | null {
  const lines = source.split("\n");
  const funcPattern = new RegExp(`function\\s+${functionName}\\s*\\(`);
  let signatureLines: string[] = [];
  let inSignature = false;

  for (const line of lines) {
    if (!inSignature && funcPattern.test(line)) inSignature = true;
    if (inSignature) {
      signatureLines.push(line);
      if (line.includes(";") || line.includes("{")) break;
    }
  }

  const signature = signatureLines.join(" ");
  const match = signature.match(/([A-Z][a-zA-Z0-9]*)\s+(?:calldata|memory|storage)/);
  if (match && !["Bytes", "String"].includes(match[1])) {
    return match[1];
  }
  return null;
}

interface CodeBlock {
  label: string;
  code: string;
  highlighted?: { light: string; dark: string };
}

export interface PrecompileCodeViewerProps {
  precompileName: keyof typeof PRECOMPILE_INTERFACES;
  highlightFunction?: string;
  children: React.ReactNode;
  className?: string;
  height?: string;
  collapsibleSections?: {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
  }[];
}

/**
 * Precompile Code Viewer
 * Split-pane layout with form controls on left and Solidity interface on right.
 * Auto-fetches precompile interfaces from ava-labs/subnet-evm repository.
 */
export function PrecompileCodeViewer({
  precompileName,
  highlightFunction,
  children,
  className = "",
  height = "auto",
  collapsibleSections,
}: PrecompileCodeViewerProps) {
  const [codeBlocks, setCodeBlocks] = useState<CodeBlock[]>([]);
  const [fullSource, setFullSource] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>(DEFAULT_FONT_SIZE);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    collapsibleSections?.forEach((section) => {
      initial[section.title] = section.defaultOpen ?? true;
    });
    return initial;
  });
  const codeScrollRef = useRef<HTMLDivElement>(null);

  const precompileConfig = PRECOMPILE_INTERFACES[precompileName];
  const subnetEvmVersion = (versions as unknown as Record<string, string>)["ava-labs/subnet-evm"] || "v0.7.2";

  const sourceUrl = useMemo(() => {
    return `https://raw.githubusercontent.com/ava-labs/subnet-evm/${subnetEvmVersion}/${precompileConfig.file}`;
  }, [precompileConfig.file, subnetEvmVersion]);

  const githubUrl = useMemo(() => {
    return `https://github.com/ava-labs/subnet-evm/blob/${subnetEvmVersion}/${precompileConfig.file}`;
  }, [precompileConfig.file, subnetEvmVersion]);

  // Load font size preference
  useEffect(() => {
    const saved = localStorage.getItem("precompile-viewer-font-size");
    if (saved && FONT_SIZES.includes(Number(saved) as FontSize)) {
      setFontSize(Number(saved) as FontSize);
    }
  }, []);

  // Detect dark mode
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Fetch source code
  useEffect(() => {
    const loadSource = async () => {
      setLoading(true);
      try {
        const res = await fetch(sourceUrl);
        if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
        const code = await res.text();
        setFullSource(code);
      } catch (err) {
        console.error("Failed to fetch precompile source:", err);
        setFullSource("// Failed to load source code");
      }
      setLoading(false);
    };
    loadSource();
  }, [sourceUrl]);

  // Extract code blocks based on highlightFunction
  useEffect(() => {
    if (!fullSource || fullSource.startsWith("//")) {
      setCodeBlocks([{ label: "source", code: fullSource || "// Loading..." }]);
      return;
    }

    const blocks: CodeBlock[] = [];

    if (highlightFunction) {
      // Try to find struct used in function signature
      const structName = findStructInSignature(fullSource, highlightFunction);
      if (structName) {
        const structCode = extractFunctionBlock(fullSource, structName, 1);
        if (structCode) {
          blocks.push({ label: `struct ${structName}`, code: structCode });
        }
      }

      // Extract function
      const funcCode = extractFunctionBlock(fullSource, highlightFunction, 1);
      if (funcCode) {
        blocks.push({ label: `${highlightFunction}()`, code: funcCode });
      }
    }

    // If no specific function, show full interface
    if (blocks.length === 0) {
      blocks.push({ label: precompileConfig.file.split("/").pop() || "source", code: fullSource });
    }

    setCodeBlocks(blocks);
  }, [fullSource, highlightFunction, precompileConfig.file]);

  // Highlight code blocks
  useEffect(() => {
    if (codeBlocks.length === 0 || codeBlocks.every((b) => b.highlighted)) return;

    (async () => {
      const highlighted = await Promise.all(
        codeBlocks.map(async (block) => {
          if (block.highlighted) return block;
          const [light, dark] = await Promise.all([
            codeToHtml(block.code, { lang: "solidity", theme: "github-light" }),
            codeToHtml(block.code, { lang: "solidity", theme: "github-dark" }),
          ]);
          return { ...block, highlighted: { light, dark } };
        })
      );
      setCodeBlocks(highlighted);
    })();
  }, [codeBlocks.map((b) => b.code).join("")]);

  const handleCopy = useCallback(async () => {
    const codeToCopy = codeBlocks.map((b) => b.code).join("\n\n");
    await navigator.clipboard.writeText(codeToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [codeBlocks]);

  const adjustFontSize = useCallback((delta: number) => {
    setFontSize((prev) => {
      const idx = FONT_SIZES.indexOf(prev);
      const newIdx = Math.max(0, Math.min(FONT_SIZES.length - 1, idx + delta));
      const newSize = FONT_SIZES[newIdx];
      localStorage.setItem("precompile-viewer-font-size", String(newSize));
      return newSize;
    });
  }, []);

  const toggleSection = (title: string) => {
    setExpandedSections((prev) => ({ ...prev, [title]: !prev[title] }));
  };

  const filename = precompileConfig.file.split("/").pop() || "interface.sol";

  return (
    <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-6 items-start", className)}>
      {/* Left: Form Controls */}
      <div className="space-y-4">
        {children}

        {/* Collapsible Sections */}
        {collapsibleSections?.map((section) => (
          <div key={section.title} className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection(section.title)}
              className="w-full flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{section.title}</span>
              {expandedSections[section.title] ? (
                <ChevronDown className="w-4 h-4 text-zinc-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-zinc-500" />
              )}
            </button>
            {expandedSections[section.title] && (
              <div className="p-4 border-t border-zinc-200 dark:border-zinc-700">
                {section.children}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Right: Code Viewer - Sticky on scroll */}
      <div
        className={cn(
          "lg:sticky lg:top-4 flex flex-col rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800",
          height === "auto" ? "h-fit" : "overflow-hidden"
        )}
        style={height !== "auto" ? { height } : undefined}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center gap-2 px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200/80 dark:border-zinc-800">
          <FileCode className="w-4 h-4 text-amber-500" />
          <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{filename}</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">({subnetEvmVersion})</span>

          <div className="flex-1" />

          {/* Controls */}
          <div className="flex items-center gap-0.5 px-1 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800">
            <button
              onClick={() => adjustFontSize(-1)}
              disabled={fontSize === FONT_SIZES[0]}
              className="p-1.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 disabled:opacity-30 transition-colors"
              title="Decrease font size"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 w-6 text-center">{fontSize}</span>
            <button
              onClick={() => adjustFontSize(1)}
              disabled={fontSize === FONT_SIZES[FONT_SIZES.length - 1]}
              className="p-1.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 disabled:opacity-30 transition-colors"
              title="Increase font size"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
          <button
            onClick={handleCopy}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            title="Copy code"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            title="View on GitHub"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* Highlighted function indicator */}
        {highlightFunction && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
            <span className="text-xs text-amber-700 dark:text-amber-300">
              Showing: <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">{highlightFunction}()</code>
            </span>
          </div>
        )}

        {/* Code Content */}
        <div
          ref={codeScrollRef}
          className={cn(
            "flex-1 overflow-auto",
            height === "auto" ? "max-h-[500px]" : ""
          )}
        >
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400">
                <div className="w-4 h-4 border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-600 dark:border-t-zinc-300 rounded-full animate-spin" />
                <span className="text-sm">Loading interface...</span>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {codeBlocks.map((block, idx) => (
                <div key={idx}>
                  {/* Block Label */}
                  {codeBlocks.length > 1 && (
                    <div className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800">
                      <span
                        className={cn(
                          "text-[10px] font-mono px-1.5 py-0.5 rounded",
                          block.label.startsWith("struct")
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                            : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                        )}
                      >
                        {block.label}
                      </span>
                    </div>
                  )}
                  {/* Code */}
                  <div
                    className="py-3 px-4 overflow-x-auto precompile-shiki-container font-mono"
                    style={{ "--code-font-size": `${fontSize}px`, fontSize: `${fontSize}px`, lineHeight: 1.6 } as React.CSSProperties}
                  >
                    {block.highlighted ? (
                      <div dangerouslySetInnerHTML={{ __html: isDark ? block.highlighted.dark : block.highlighted.light }} />
                    ) : (
                      <pre className="text-zinc-600 dark:text-zinc-400">{block.code}</pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Shiki reset styles */}
      <style jsx global>{`
        .precompile-shiki-container pre {
          background: transparent !important;
          margin: 0;
          padding: 0;
          min-width: max-content;
        }
        .precompile-shiki-container pre,
        .precompile-shiki-container code,
        .precompile-shiki-container span {
          font-size: var(--code-font-size, 11px) !important;
          line-height: 1.6 !important;
        }
        .precompile-shiki-container code {
          display: block;
          min-width: max-content;
        }
        .precompile-shiki-container .line {
          display: block;
          min-width: max-content;
        }
      `}</style>
    </div>
  );
}

/**
 * Hook to update the highlighted function dynamically
 */
export function usePrecompileHighlight() {
  const [highlightFunction, setHighlightFunction] = useState<string | undefined>();
  return { highlightFunction, setHighlightFunction };
}
