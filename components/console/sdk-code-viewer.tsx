"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { codeToHtml } from "shiki";
import { Copy, Check, ExternalLink, FileCode, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SDKCodeSource {
  name: string;
  filename: string;
  code: string;
  description?: string;
  githubUrl?: string;
}

interface SDKCodeViewerProps {
  sources: SDKCodeSource[];
  children: React.ReactNode;
  className?: string;
  height?: string;
}

const FONT_SIZES = [10, 11, 12, 13, 14] as const;
type FontSize = (typeof FONT_SIZES)[number];
const DEFAULT_FONT_SIZE: FontSize = 12;

/**
 * Split-pane SDK code viewer
 * Left: Form controls (children)
 * Right: Tabbed TypeScript code viewer with line numbers and syntax highlighting
 */
export function SDKCodeViewer({
  sources,
  children,
  className = "",
  height = "500px",
}: SDKCodeViewerProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [highlighted, setHighlighted] = useState<Record<number, { light: string; dark: string }>>({});
  const [copied, setCopied] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>(DEFAULT_FONT_SIZE);
  const codeScrollRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Load font size preference
  useEffect(() => {
    const saved = localStorage.getItem("sdk-viewer-font-size");
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
  }, [highlighted, activeTab]);

  const adjustFontSize = useCallback((delta: number) => {
    setFontSize((prev) => {
      const idx = FONT_SIZES.indexOf(prev);
      const newIdx = Math.max(0, Math.min(FONT_SIZES.length - 1, idx + delta));
      const newSize = FONT_SIZES[newIdx];
      localStorage.setItem("sdk-viewer-font-size", String(newSize));
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

  // Highlight code when source changes
  useEffect(() => {
    const source = sources[activeTab];
    if (!source) return;

    Promise.all([
      codeToHtml(source.code, { lang: "typescript", theme: "github-light" }),
      codeToHtml(source.code, { lang: "typescript", theme: "github-dark" }),
    ]).then(([light, dark]) => {
      setHighlighted((prev) => ({ ...prev, [activeTab]: { light, dark } }));
    });
  }, [activeTab, sources]);

  const handleCopy = useCallback(async () => {
    const source = sources[activeTab];
    if (!source) return;
    await navigator.clipboard.writeText(source.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [activeTab, sources]);

  const lineCount = useMemo(() => {
    const source = sources[activeTab];
    if (!source) return 0;
    return source.code.split("\n").length;
  }, [sources, activeTab]);

  const activeSource = sources[activeTab];
  const activeHighlight = highlighted[activeTab];

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${className}`}>
      {/* Left: Form Controls */}
      <div>{children}</div>

      {/* Right: SDK Code Viewer */}
      <div
        className={cn(
          "flex flex-col rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800",
          height === "auto" ? "h-fit" : "overflow-hidden"
        )}
        style={height !== "auto" ? { height } : undefined}
      >
        {/* Tab Bar */}
        <div className="shrink-0 flex items-center gap-1 px-2 pt-2 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200/80 dark:border-zinc-800">
          {sources.map((source, i) => (
            <button
              key={source.filename}
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
              {source.filename}
            </button>
          ))}

          <div className="flex-1" />

          {/* Actions */}
          <div className="flex items-center gap-1 pb-2">
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
              title="Copy code"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </button>
            {activeSource?.githubUrl && (
              <a
                href={activeSource.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
                title="View on GitHub"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>

        {/* Code Content with Line Numbers */}
        <div className={cn("flex-1 flex", height !== "auto" && "min-h-0")}>
          {activeHighlight ? (
            <>
              {/* Line Numbers */}
              <div
                ref={lineNumbersRef}
                className={cn(
                  "shrink-0 py-4 pl-4 pr-3 text-right select-none border-r border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 font-mono sdk-line-numbers",
                  height === "auto" ? "" : "overflow-hidden"
                )}
                style={{
                  "--sdk-font-size": `${fontSize}px`,
                  fontSize: `${fontSize}px`,
                  lineHeight: 1.5
                } as React.CSSProperties}
              >
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i} className="text-zinc-400 dark:text-zinc-600">
                    {i + 1}
                  </div>
                ))}
              </div>
              {/* Code */}
              <div
                ref={codeScrollRef}
                className={cn(
                  "flex-1 py-4 pl-4 pr-4 font-mono sdk-shiki-container overflow-x-auto",
                  height === "auto" ? "" : "overflow-y-auto"
                )}
                style={{
                  "--sdk-font-size": `${fontSize}px`,
                  fontSize: `${fontSize}px`,
                  lineHeight: 1.5
                } as React.CSSProperties}
                dangerouslySetInnerHTML={{
                  __html: isDark ? activeHighlight.dark : activeHighlight.light,
                }}
              />
            </>
          ) : (
            <>
              {/* Line Numbers - fallback */}
              <div
                ref={lineNumbersRef}
                className={cn(
                  "shrink-0 py-4 pl-4 pr-3 text-right select-none border-r border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 font-mono sdk-line-numbers",
                  height === "auto" ? "" : "overflow-hidden"
                )}
                style={{
                  "--sdk-font-size": `${fontSize}px`,
                  fontSize: `${fontSize}px`,
                  lineHeight: 1.5
                } as React.CSSProperties}
              >
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i} className="text-zinc-400 dark:text-zinc-600">
                    {i + 1}
                  </div>
                ))}
              </div>
              {/* Code - fallback */}
              <pre
                ref={codeScrollRef as React.RefObject<HTMLPreElement>}
                className={cn(
                  "flex-1 py-4 pl-4 pr-4 text-zinc-800 dark:text-zinc-200 whitespace-pre font-mono overflow-x-auto",
                  height === "auto" ? "" : "overflow-y-auto"
                )}
                style={{
                  "--sdk-font-size": `${fontSize}px`,
                  fontSize: `${fontSize}px`,
                  lineHeight: 1.5,
                  minWidth: "max-content"
                } as React.CSSProperties}
              >
                {activeSource?.code}
              </pre>
            </>
          )}
        </div>

        {/* Footer */}
        {activeSource?.description && (
          <div className="shrink-0 px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200/80 dark:border-zinc-800">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{activeSource.description}</p>
          </div>
        )}
      </div>

      {/* Shiki reset styles */}
      <style jsx global>{`
        .sdk-shiki-container pre {
          background: transparent !important;
          margin: 0 !important;
          padding: 0 !important;
          font-size: inherit !important;
          line-height: inherit !important;
        }
        .sdk-shiki-container pre code {
          display: flex !important;
          flex-direction: column !important;
          font-size: inherit !important;
          line-height: inherit !important;
        }
        .sdk-shiki-container .line {
          display: block;
        }
      `}</style>
    </div>
  );
}
