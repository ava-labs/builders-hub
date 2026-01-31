"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { codeToHtml } from "shiki";
import { Copy, Check, ExternalLink, Minus, Plus, Code2, FileCode } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepConfig {
  id: string;
  title: string;
  description: string;
  codeType?: "solidity" | "typescript";
  code?: string;
  sourceUrl?: string;
  githubUrl?: string;
  highlightFunction?: string;
  filename?: string;
}

interface StepCodeViewerProps {
  activeStep: number;
  steps: StepConfig[];
  className?: string;
}

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

interface CodeBlock {
  label: string;
  code: string;
  highlighted?: { light: string; dark: string };
}

export function StepCodeViewer({
  activeStep,
  steps,
  className = "",
}: StepCodeViewerProps) {
  const [codeBlocks, setCodeBlocks] = useState<CodeBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>(DEFAULT_FONT_SIZE);

  // Find the current step config - automatically follows activeStep
  const currentConfig = steps[activeStep];
  const hasCode = currentConfig?.codeType && (currentConfig?.code || currentConfig?.sourceUrl);

  // Find nearest code step for display when current step has no code
  const displayStep = useMemo(() => {
    if (hasCode) return currentConfig;
    // Find the nearest previous step with code
    for (let i = activeStep - 1; i >= 0; i--) {
      const step = steps[i];
      if (step.codeType && (step.code || step.sourceUrl)) {
        return step;
      }
    }
    // Find the nearest next step with code
    for (let i = activeStep + 1; i < steps.length; i++) {
      const step = steps[i];
      if (step.codeType && (step.code || step.sourceUrl)) {
        return step;
      }
    }
    return null;
  }, [activeStep, currentConfig, hasCode, steps]);

  useEffect(() => {
    const saved = localStorage.getItem("step-viewer-font-size");
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

  // Fetch and process code based on displayStep
  useEffect(() => {
    if (!displayStep) {
      setCodeBlocks([]);
      return;
    }

    const loadCode = async () => {
      setLoading(true);
      const blocks: CodeBlock[] = [];

      try {
        if (displayStep.codeType === "typescript" && displayStep.code) {
          // TypeScript: use inline code directly
          blocks.push({
            label: displayStep.filename || "code.ts",
            code: displayStep.code,
          });
        } else if (displayStep.codeType === "solidity" && displayStep.sourceUrl) {
          // Solidity: fetch from remote and extract function
          const res = await fetch(displayStep.sourceUrl);
          const fullCode = await res.text();

          if (displayStep.highlightFunction) {
            // Try to find struct used in function signature
            const structName = findStructInSignature(fullCode, displayStep.highlightFunction);
            if (structName) {
              const structCode = extractFunctionBlock(fullCode, structName, 1);
              if (structCode) {
                blocks.push({ label: structName, code: structCode });
              }
            }

            // Extract function
            const funcCode = extractFunctionBlock(fullCode, displayStep.highlightFunction, 1);
            if (funcCode) {
              blocks.push({ label: `${displayStep.highlightFunction}()`, code: funcCode });
            }
          }

          // Fallback to full source
          if (blocks.length === 0) {
            blocks.push({ label: displayStep.filename || "source", code: fullCode });
          }
        }
      } catch (err) {
        console.error("Failed to load code:", err);
        blocks.push({ label: "error", code: "// Failed to load source code" });
      }

      setCodeBlocks(blocks);
      setLoading(false);
    };

    loadCode();
  }, [displayStep?.id, displayStep?.sourceUrl, displayStep?.code, displayStep?.highlightFunction]);

  // Highlight code blocks
  useEffect(() => {
    if (codeBlocks.length === 0 || codeBlocks.every((b) => b.highlighted)) return;

    (async () => {
      const lang = displayStep?.codeType === "typescript" ? "typescript" : "solidity";
      const highlighted = await Promise.all(
        codeBlocks.map(async (block) => {
          if (block.highlighted) return block;
          const [light, dark] = await Promise.all([
            codeToHtml(block.code, { lang, theme: "github-light" }),
            codeToHtml(block.code, { lang, theme: "github-dark" }),
          ]);
          return { ...block, highlighted: { light, dark } };
        })
      );
      setCodeBlocks(highlighted);
    })();
  }, [codeBlocks.map((b) => b.code).join(""), displayStep?.codeType]);

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
      localStorage.setItem("step-viewer-font-size", String(newSize));
      return newSize;
    });
  }, []);

  if (!displayStep) {
    return (
      <div className={cn("lg:sticky lg:top-4 flex flex-col rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-6", className)}>
        <div className="text-center text-zinc-500 dark:text-zinc-400">
          <Code2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No code to display for this step</p>
        </div>
      </div>
    );
  }

  const stepIndex = steps.findIndex(s => s.id === displayStep.id);

  return (
    <div className={cn("lg:sticky lg:top-4 flex flex-col rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 overflow-hidden", className)}>
      {/* Header - Shows current step info */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200/80 dark:border-zinc-800">
        {/* Step indicator */}
        <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
          {stepIndex + 1}
        </span>

        {/* Language icon */}
        {displayStep.codeType === "typescript" ? (
          <Code2 className="w-4 h-4 text-blue-500" />
        ) : (
          <FileCode className="w-4 h-4 text-amber-500" />
        )}

        {/* Step title */}
        <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
          {displayStep.title}
        </span>

        <div className="flex-1" />

        {/* Controls */}
        <div className="flex items-center gap-0.5 px-1 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800">
          <button
            onClick={() => adjustFontSize(-1)}
            disabled={fontSize === FONT_SIZES[0]}
            className="p-1.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 disabled:opacity-30 transition-colors"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 w-6 text-center">{fontSize}</span>
          <button
            onClick={() => adjustFontSize(1)}
            disabled={fontSize === FONT_SIZES[FONT_SIZES.length - 1]}
            className="p-1.5 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 disabled:opacity-30 transition-colors"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
        <button
          onClick={handleCopy}
          className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
        >
          {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
        </button>
        {displayStep.githubUrl && (
          <a
            href={displayStep.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>

      {/* File tab */}
      <div className="px-4 py-2 bg-zinc-50/50 dark:bg-zinc-800/30 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <span className={cn(
            "px-2 py-0.5 text-[10px] font-mono rounded",
            displayStep.codeType === "typescript"
              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
              : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
          )}>
            {displayStep.filename}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {displayStep.description}
          </span>
        </div>
      </div>

      {/* Code Content */}
      <div className="overflow-auto max-h-[500px]">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400">
              <div className="w-4 h-4 border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-600 dark:border-t-zinc-300 rounded-full animate-spin" />
              <span className="text-sm">Loading source...</span>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {codeBlocks.map((block, idx) => (
              <div key={idx}>
                {/* Block Label (for struct + function pairs) */}
                {codeBlocks.length > 1 && (
                  <div className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-100 dark:border-zinc-800">
                    <span
                      className={cn(
                        "text-[10px] font-mono px-1.5 py-0.5 rounded",
                        idx === 0
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
                  className="py-3 px-4 overflow-x-auto shiki-container font-mono"
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
      `}</style>
    </div>
  );
}
