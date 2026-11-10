"use client";

import { useState, useEffect, useCallback } from "react";
import { codeToHtml } from "shiki";
import { Copy, Check, ExternalLink, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SourceConfig {
  filename: string;
  sourceUrl: string;
  githubUrl: string;
  highlightFunction?: string;
}

export interface ContractFunctionViewerProps {
  /** Single source (legacy) */
  contractName?: string;
  filename?: string;
  sourceUrl?: string;
  githubUrl?: string;
  highlightFunction?: string;
  /** Multiple sources with tabs */
  sources?: SourceConfig[];
  /** Optional description for footer */
  description?: string;
  className?: string;
  showFunctionOnly?: boolean;
  contextLines?: number;
}

const FONT_SIZES = [10, 11, 12, 13, 14] as const;
type FontSize = (typeof FONT_SIZES)[number];
const DEFAULT_FONT_SIZE: FontSize = 11;

function extractCodeBlock(source: string, name: string, contextLines: number = 1): string | null {
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

  if (startLine !== -1) {
    const start = Math.max(0, startLine - contextLines);
    const end = Math.min(lines.length - 1, startLine + 25);
    return lines.slice(start, end + 1).join("\n");
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
      if (line.includes("{")) break;
    }
  }

  const signature = signatureLines.join(" ");
  const match = signature.match(/([A-Z][a-zA-Z0-9]*)\s+(?:calldata|memory|storage)/);
  if (match && !["Bytes", "String"].includes(match[1])) {
    return match[1];
  }
  return null;
}

interface TabData {
  filename: string;
  githubUrl: string;
  code: string;
  highlighted?: { light: string; dark: string };
}

interface CodeBlockData {
  label: string;
  code: string;
  highlighted?: { light: string; dark: string };
}

export function ContractFunctionViewer({
  contractName,
  filename,
  sourceUrl,
  githubUrl,
  highlightFunction,
  sources,
  description,
  className = "",
  showFunctionOnly = false,
  contextLines = 1,
}: ContractFunctionViewerProps) {
  // Multi-source mode (tabs)
  const [tabs, setTabs] = useState<TabData[]>([]);
  const [activeTab, setActiveTab] = useState(0);

  // Single-source mode (stacked blocks for struct + function)
  const [codeBlocks, setCodeBlocks] = useState<CodeBlockData[]>([]);

  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>(DEFAULT_FONT_SIZE);

  const isMultiSource = !!sources && sources.length > 0;

  useEffect(() => {
    const saved = localStorage.getItem("contract-viewer-font-size");
    if (saved && FONT_SIZES.includes(Number(saved) as FontSize)) {
      setFontSize(Number(saved) as FontSize);
    }
  }, []);

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Multi-source mode: fetch all sources for tabs
  useEffect(() => {
    if (!isMultiSource || !sources) return;

    setLoading(true);
    Promise.all(
      sources.map(async (src) => {
        try {
          const res = await fetch(src.sourceUrl);
          const fullCode = await res.text();

          let code = fullCode;
          if (showFunctionOnly && src.highlightFunction) {
            const extracted = extractCodeBlock(fullCode, src.highlightFunction, contextLines);
            if (extracted) code = extracted;
          }

          return {
            filename: src.filename,
            githubUrl: src.githubUrl,
            code,
          };
        } catch (err) {
          console.error(`Failed to fetch ${src.filename}:`, err);
          return {
            filename: src.filename,
            githubUrl: src.githubUrl,
            code: "// Failed to load source code",
          };
        }
      })
    ).then((results) => {
      setTabs(results);
      setLoading(false);
    });
  }, [isMultiSource, sources?.map(s => s.sourceUrl).join(","), showFunctionOnly, contextLines]);

  // Single-source mode: fetch and extract struct + function
  useEffect(() => {
    if (isMultiSource || !sourceUrl) return;

    setLoading(true);
    fetch(sourceUrl)
      .then((res) => res.text())
      .then((fullCode) => {
        const blocks: CodeBlockData[] = [];

        if (showFunctionOnly && highlightFunction) {
          // Try to find struct used in function signature (from same file)
          const structName = findStructInSignature(fullCode, highlightFunction);
          if (structName) {
            const structCode = extractCodeBlock(fullCode, structName, contextLines);
            if (structCode) {
              blocks.push({ label: structName, code: structCode });
            }
          }

          // Extract function
          const funcCode = extractCodeBlock(fullCode, highlightFunction, contextLines);
          if (funcCode) {
            blocks.push({ label: `${highlightFunction}()`, code: funcCode });
          }
        }

        // Fallback to full source
        if (blocks.length === 0) {
          blocks.push({ label: filename || "source", code: fullCode });
        }

        setCodeBlocks(blocks);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch source:", err);
        setCodeBlocks([{ label: filename || "source", code: "// Failed to load source code" }]);
        setLoading(false);
      });
  }, [isMultiSource, sourceUrl, highlightFunction, showFunctionOnly, contextLines, filename]);

  // Highlight tabs
  useEffect(() => {
    if (tabs.length === 0 || tabs.every(t => t.highlighted)) return;

    (async () => {
      const highlighted = await Promise.all(
        tabs.map(async (tab) => {
          if (tab.highlighted) return tab;
          const [light, dark] = await Promise.all([
            codeToHtml(tab.code, { lang: "solidity", theme: "github-light" }),
            codeToHtml(tab.code, { lang: "solidity", theme: "github-dark" }),
          ]);
          return { ...tab, highlighted: { light, dark } };
        })
      );
      setTabs(highlighted);
    })();
  }, [tabs.map(t => t.code).join("")]);

  // Highlight code blocks
  useEffect(() => {
    if (codeBlocks.length === 0 || codeBlocks.every(b => b.highlighted)) return;

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
  }, [codeBlocks.map(b => b.code).join("")]);

  const handleCopy = useCallback(async () => {
    let codeToCopy = "";
    if (isMultiSource && tabs[activeTab]) {
      codeToCopy = tabs[activeTab].code;
    } else {
      codeToCopy = codeBlocks.map(b => b.code).join("\n\n");
    }
    await navigator.clipboard.writeText(codeToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [isMultiSource, tabs, activeTab, codeBlocks]);

  const adjustFontSize = useCallback((delta: number) => {
    setFontSize((prev) => {
      const idx = FONT_SIZES.indexOf(prev);
      const newIdx = Math.max(0, Math.min(FONT_SIZES.length - 1, idx + delta));
      const newSize = FONT_SIZES[newIdx];
      localStorage.setItem("contract-viewer-font-size", String(newSize));
      return newSize;
    });
  }, []);

  const currentTab = tabs[activeTab];
  const currentGithubUrl = isMultiSource ? currentTab?.githubUrl : githubUrl;

  return (
    <div className={cn("lg:sticky lg:top-4 flex flex-col border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 overflow-hidden", className)}>
      {/* Tab Bar */}
      <div className="shrink-0 flex items-center gap-1 px-4 border-b border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/40">
        {/* File Tabs (multi-source mode) */}
        {isMultiSource ? (
          <div className="flex items-center gap-5">
            {tabs.map((tab, idx) => (
              <button
                key={idx}
                onClick={() => setActiveTab(idx)}
                className={cn(
                  "-mb-px border-b-2 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.1em] transition-colors",
                  activeTab === idx
                    ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                    : "border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                )}
              >
                {tab.filename}
              </button>
            ))}
          </div>
        ) : (
          <div className="-mb-px border-b-2 border-zinc-900 py-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.1em] text-zinc-900 dark:border-zinc-100 dark:text-zinc-100">
            {filename}
          </div>
        )}

        <div className="flex-1" />

        {/* Controls */}
        <div className="mr-1 flex items-center border border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => adjustFontSize(-1)}
            disabled={fontSize === FONT_SIZES[0]}
            className="p-1.5 text-zinc-400 transition-colors hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-30 dark:text-zinc-500 dark:hover:text-zinc-100"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="w-6 border-x border-zinc-200 text-center font-mono text-[10px] tabular-nums text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">{fontSize}</span>
          <button
            onClick={() => adjustFontSize(1)}
            disabled={fontSize === FONT_SIZES[FONT_SIZES.length - 1]}
            className="p-1.5 text-zinc-400 transition-colors hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-30 dark:text-zinc-500 dark:hover:text-zinc-100"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
        <button
          onClick={handleCopy}
          className="p-1.5 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
        {currentGithubUrl && (
          <a
            href={currentGithubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>

      {/* Code Content */}
      <div className={cn("overflow-auto", isMultiSource && "max-h-[400px]")}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400">
              <div className="h-3.5 w-3.5 border-2 border-zinc-300 border-t-zinc-700 rounded-full animate-spin dark:border-zinc-700 dark:border-t-zinc-300" />
              <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.14em]">Loading source…</span>
            </div>
          </div>
        ) : isMultiSource ? (
          // Multi-source: show active tab content
          currentTab && (
            <div
              className="py-3 px-4 overflow-x-auto contract-fn-shiki-container font-mono"
              style={{ "--code-font-size": `${fontSize}px`, fontSize: `${fontSize}px`, lineHeight: 1.6 } as React.CSSProperties}
            >
              {currentTab.highlighted ? (
                <div dangerouslySetInnerHTML={{ __html: isDark ? currentTab.highlighted.dark : currentTab.highlighted.light }} />
              ) : (
                <pre className="text-zinc-600 dark:text-zinc-400">{currentTab.code}</pre>
              )}
            </div>
          )
        ) : (
          // Single-source: show stacked code blocks (struct + function)
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {codeBlocks.map((block, idx) => (
              <div key={idx}>
                {/* Block Label */}
                {codeBlocks.length > 1 && (
                  <div className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800">
                    <span className={cn(
                      "border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em]",
                      idx === 0
                        ? "border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
                        : "border-amber-200 text-amber-700 dark:border-amber-900/60 dark:text-amber-400"
                    )}>
                      {block.label}
                    </span>
                  </div>
                )}
                {/* Code */}
                <div
                  className="py-3 px-4 overflow-x-auto contract-fn-shiki-container font-mono"
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

      {/* Footer */}
      {description && (
        <div className="shrink-0 px-4 py-2 border-t border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/40">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{description}</p>
        </div>
      )}

      <style jsx global>{`
        .contract-fn-shiki-container pre {
          background: transparent !important;
          margin: 0;
          padding: 0;
          min-width: max-content;
        }
        .contract-fn-shiki-container pre,
        .contract-fn-shiki-container code,
        .contract-fn-shiki-container span {
          font-size: var(--code-font-size, 11px) !important;
          line-height: 1.6 !important;
        }
        .contract-fn-shiki-container code {
          display: block;
          min-width: max-content;
        }
        .contract-fn-shiki-container .line {
          display: block;
          min-width: max-content;
        }
      `}</style>
    </div>
  );
}
