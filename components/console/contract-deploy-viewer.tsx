"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { codeToHtml } from "shiki";
import { Copy, Check, ExternalLink, FileCode, Minus, Plus } from "lucide-react";

export interface ContractSource {
  name: string;
  filename: string;
  url: string;
  description?: string;
}

interface ContractDeployViewerProps {
  contracts: ContractSource[];
  children: React.ReactNode;
  className?: string;
}

const FONT_SIZES = [10, 11, 12, 13, 14] as const;
type FontSize = typeof FONT_SIZES[number];
const DEFAULT_FONT_SIZE: FontSize = 11;

/**
 * Split-pane contract deployment viewer
 * Left: Deploy controls (children)
 * Right: Tabbed source code viewer with line numbers
 */
export function ContractDeployViewer({
  contracts,
  children,
  className = "",
}: ContractDeployViewerProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [sources, setSources] = useState<Record<number, string>>({});
  const [highlighted, setHighlighted] = useState<Record<number, { light: string; dark: string }>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>(DEFAULT_FONT_SIZE);
  const codeScrollRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Load font size preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("contract-viewer-font-size");
    if (saved && FONT_SIZES.includes(Number(saved) as FontSize)) {
      setFontSize(Number(saved) as FontSize);
    }
  }, []);

  // Sync vertical scroll between line numbers and code
  useEffect(() => {
    const codeEl = codeScrollRef.current;
    const lineEl = lineNumbersRef.current;
    if (!codeEl || !lineEl) return;

    const handleScroll = () => {
      lineEl.scrollTop = codeEl.scrollTop;
    };
    codeEl.addEventListener("scroll", handleScroll);
    return () => codeEl.removeEventListener("scroll", handleScroll);
  }, [highlighted, sources]);

  const adjustFontSize = useCallback((delta: number) => {
    setFontSize((prev) => {
      const idx = FONT_SIZES.indexOf(prev);
      const newIdx = Math.max(0, Math.min(FONT_SIZES.length - 1, idx + delta));
      const newSize = FONT_SIZES[newIdx];
      localStorage.setItem("contract-viewer-font-size", String(newSize));
      return newSize;
    });
  }, []);

  // Detect dark mode
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Fetch and highlight source for active tab
  useEffect(() => {
    const contract = contracts[activeTab];
    if (!contract || sources[activeTab] !== undefined) return;

    setLoading((prev) => ({ ...prev, [activeTab]: true }));

    fetch(contract.url)
      .then((res) => res.text())
      .then(async (code) => {
        setSources((prev) => ({ ...prev, [activeTab]: code }));

        // Highlight with Shiki
        const [light, dark] = await Promise.all([
          codeToHtml(code, { lang: "solidity", theme: "github-light" }),
          codeToHtml(code, { lang: "solidity", theme: "github-dark" }),
        ]);
        setHighlighted((prev) => ({ ...prev, [activeTab]: { light, dark } }));
      })
      .catch((err) => {
        console.error("Failed to fetch source:", err);
        setSources((prev) => ({ ...prev, [activeTab]: "// Failed to load source code" }));
      })
      .finally(() => {
        setLoading((prev) => ({ ...prev, [activeTab]: false }));
      });
  }, [activeTab, contracts, sources]);

  const handleCopy = useCallback(async () => {
    const source = sources[activeTab];
    if (!source) return;
    await navigator.clipboard.writeText(source);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [activeTab, sources]);

  // Calculate line count for line numbers
  const lineCount = useMemo(() => {
    const source = sources[activeTab];
    if (!source) return 0;
    return source.split("\n").length;
  }, [sources, activeTab]);

  const activeContract = contracts[activeTab];
  const activeHighlight = highlighted[activeTab];
  const isLoading = loading[activeTab];

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${className}`}>
      {/* Left: Deploy Controls */}
      <div>{children}</div>

      {/* Right: Source Code Viewer */}
      <div className="flex flex-col rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 overflow-hidden h-[500px]">
        {/* Tab Bar */}
        <div className="shrink-0 flex items-center gap-1 px-2 pt-2 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200/80 dark:border-zinc-800">
          {contracts.map((contract, i) => (
            <button
              key={contract.filename}
              onClick={() => setActiveTab(i)}
              className={`
                flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-t-lg transition-colors
                ${
                  activeTab === i
                    ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border-t border-x border-zinc-200/80 dark:border-zinc-700 -mb-px"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                }
              `}
            >
              <FileCode className="w-4 h-4" />
              {contract.filename}
            </button>
          ))}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Actions */}
          <div className="flex items-center gap-1 pb-2">
            {/* Font size controls */}
            <div className="flex items-center gap-0.5 mr-1 px-1 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800">
              <button
                onClick={() => adjustFontSize(-1)}
                disabled={fontSize === FONT_SIZES[0]}
                className="p-1.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Decrease font size"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 w-6 text-center">
                {fontSize}
              </span>
              <button
                onClick={() => adjustFontSize(1)}
                disabled={fontSize === FONT_SIZES[FONT_SIZES.length - 1]}
                className="p-1.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Increase font size"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <button
              onClick={handleCopy}
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              title="Copy source"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
            <a
              href={activeContract?.url.replace("/raw/", "/blob/").replace("raw.githubusercontent.com", "github.com")}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              title="View on GitHub"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Code Content with Line Numbers */}
        <div className="flex-1 flex min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center w-full">
              <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400">
                <div className="w-4 h-4 border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-600 dark:border-t-zinc-300 rounded-full animate-spin" />
                <span className="text-sm">Loading source...</span>
              </div>
            </div>
          ) : activeHighlight ? (
            <>
              {/* Line Numbers - fixed, only vertical scroll */}
              <div
                ref={lineNumbersRef}
                className="shrink-0 py-4 pl-4 pr-3 text-right select-none border-r border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 overflow-hidden font-mono code-line-numbers"
                style={{
                  "--code-font-size": `${fontSize}px`,
                  fontSize: `${fontSize}px`,
                  lineHeight: 1.6
                } as React.CSSProperties}
              >
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i} className="text-zinc-400 dark:text-zinc-600">
                    {i + 1}
                  </div>
                ))}
              </div>
              {/* Code - scrollable both directions */}
              <div
                ref={codeScrollRef}
                className="flex-1 py-4 pl-4 pr-4 overflow-auto shiki-container font-mono"
                style={{
                  "--code-font-size": `${fontSize}px`,
                  fontSize: `${fontSize}px`,
                  lineHeight: 1.6
                } as React.CSSProperties}
                dangerouslySetInnerHTML={{
                  __html: isDark ? activeHighlight.dark : activeHighlight.light,
                }}
              />
            </>
          ) : sources[activeTab] ? (
            <>
              {/* Line Numbers - fixed, only vertical scroll */}
              <div
                ref={lineNumbersRef}
                className="shrink-0 py-4 pl-4 pr-3 text-right select-none border-r border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 overflow-hidden font-mono code-line-numbers"
                style={{
                  "--code-font-size": `${fontSize}px`,
                  fontSize: `${fontSize}px`,
                  lineHeight: 1.6
                } as React.CSSProperties}
              >
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i} className="text-zinc-400 dark:text-zinc-600">
                    {i + 1}
                  </div>
                ))}
              </div>
              {/* Code - scrollable both directions */}
              <pre
                ref={codeScrollRef as React.RefObject<HTMLPreElement>}
                className="flex-1 py-4 pl-4 pr-4 text-zinc-800 dark:text-zinc-200 whitespace-pre overflow-auto font-mono"
                style={{
                  "--code-font-size": `${fontSize}px`,
                  fontSize: `${fontSize}px`,
                  lineHeight: 1.6,
                  minWidth: "max-content"
                } as React.CSSProperties}
              >
                {sources[activeTab]}
              </pre>
            </>
          ) : null}
        </div>

        {/* Footer with contract info */}
        {activeContract?.description && (
          <div className="shrink-0 px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200/80 dark:border-zinc-800">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {activeContract.description}
            </p>
          </div>
        )}
      </div>

      {/* Shiki reset styles */}
      <style jsx global>{`
        .shiki-container pre {
          background: transparent !important;
          margin: 0;
          padding: 0;
          min-width: max-content;
        }
        .shiki-container pre,
        .shiki-container code,
        .shiki-container span {
          font-size: var(--code-font-size, 11px) !important;
          line-height: 1.6 !important;
        }
        .shiki-container code {
          display: block;
          min-width: max-content;
        }
        .shiki-container .line {
          display: block;
          min-width: max-content;
        }
        .code-line-numbers,
        .code-line-numbers div {
          font-size: var(--code-font-size, 11px) !important;
          line-height: 1.6 !important;
        }
      `}</style>
    </div>
  );
}
