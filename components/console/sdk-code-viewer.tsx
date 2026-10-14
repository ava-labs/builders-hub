'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { codeToHtml } from 'shiki';
import { Copy, Check, ExternalLink, FileCode, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

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
export function SDKCodeViewer({ sources, children, className = '', height = '500px' }: SDKCodeViewerProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [highlighted, setHighlighted] = useState<Record<number, { light: string; dark: string }>>({});
  const [copied, setCopied] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>(DEFAULT_FONT_SIZE);
  const codeScrollRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Load font size preference
  useEffect(() => {
    const saved = localStorage.getItem('sdk-viewer-font-size');
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
    codeEl.addEventListener('scroll', handleScroll);
    return () => codeEl.removeEventListener('scroll', handleScroll);
  }, [highlighted, activeTab]);

  const adjustFontSize = useCallback((delta: number) => {
    setFontSize((prev) => {
      const idx = FONT_SIZES.indexOf(prev);
      const newIdx = Math.max(0, Math.min(FONT_SIZES.length - 1, idx + delta));
      const newSize = FONT_SIZES[newIdx];
      localStorage.setItem('sdk-viewer-font-size', String(newSize));
      return newSize;
    });
  }, []);

  // Detect dark mode
  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains('dark'));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Highlight code when source changes
  useEffect(() => {
    const source = sources[activeTab];
    if (!source) return;

    Promise.all([
      codeToHtml(source.code, { lang: 'typescript', theme: 'github-light' }),
      codeToHtml(source.code, { lang: 'typescript', theme: 'github-dark' }),
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
    return source.code.split('\n').length;
  }, [sources, activeTab]);

  const activeSource = sources[activeTab];
  const activeHighlight = highlighted[activeTab];

  return (
    <div className={cn('grid grid-cols-1 lg:grid-cols-2 gap-6', className)}>
      {/* Left: Form Controls */}
      <div>{children}</div>

      {/* Right: SDK Code Viewer */}
      <div
        className={cn(
          'flex flex-col border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950',
          height === 'auto' ? 'h-fit' : 'overflow-hidden',
        )}
        style={height !== 'auto' ? { height } : undefined}
      >
        {/* Tab Bar */}
        <div className="flex shrink-0 items-center gap-5 overflow-x-auto border-b border-zinc-200 bg-zinc-50/80 px-4 [scrollbar-width:none] dark:border-zinc-800 dark:bg-zinc-900/40 [&::-webkit-scrollbar]:hidden">
          {sources.map((source, i) => (
            <button
              key={source.filename}
              onClick={() => setActiveTab(i)}
              className={cn(
                '-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 py-2.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] transition-colors',
                activeTab === i
                  ? 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-50'
                  : 'border-transparent text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100',
              )}
            >
              <FileCode className="h-3.5 w-3.5" />
              {source.filename}
            </button>
          ))}

          <div className="flex-1" />

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-3 py-1.5">
            <div className="flex items-center border border-zinc-200 dark:border-zinc-800">
              <button
                onClick={() => adjustFontSize(-1)}
                disabled={fontSize === FONT_SIZES[0]}
                className="p-1.5 text-zinc-400 transition-colors hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-30 dark:text-zinc-500 dark:hover:text-zinc-100"
                title="Decrease font size"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-6 border-x border-zinc-200 text-center font-mono text-[10px] tabular-nums text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                {fontSize}
              </span>
              <button
                onClick={() => adjustFontSize(1)}
                disabled={fontSize === FONT_SIZES[FONT_SIZES.length - 1]}
                className="p-1.5 text-zinc-400 transition-colors hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-30 dark:text-zinc-500 dark:hover:text-zinc-100"
                title="Increase font size"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
            <button
              onClick={handleCopy}
              className="p-1 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
              title="Copy code"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
            {activeSource?.githubUrl && (
              <a
                href={activeSource.githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group/gh p-1 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
                title="View on GitHub"
              >
                <ExternalLink className="h-3.5 w-3.5 transition-colors group-hover/gh:text-[#E6212F]" />
              </a>
            )}
          </div>
        </div>

        {/* Code Content with Line Numbers */}
        <div className={cn('flex-1 flex', height !== 'auto' && 'min-h-0')}>
          {activeHighlight ? (
            <>
              {/* Line Numbers */}
              <div
                ref={lineNumbersRef}
                className={cn(
                  'sdk-line-numbers shrink-0 select-none border-r border-zinc-200 bg-zinc-50/60 py-4 pl-4 pr-3 text-right font-mono dark:border-zinc-800 dark:bg-zinc-900/40',
                  height === 'auto' ? '' : 'overflow-hidden',
                )}
                style={
                  {
                    '--sdk-font-size': `${fontSize}px`,
                    fontSize: `${fontSize}px`,
                    lineHeight: 1.5,
                  } as React.CSSProperties
                }
              >
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i} className="tabular-nums text-zinc-400 dark:text-zinc-600">
                    {i + 1}
                  </div>
                ))}
              </div>
              {/* Code */}
              <div
                ref={codeScrollRef}
                className={cn(
                  'flex-1 py-4 pl-4 pr-4 font-mono sdk-shiki-container overflow-x-auto',
                  height === 'auto' ? '' : 'overflow-y-auto',
                )}
                style={
                  {
                    '--sdk-font-size': `${fontSize}px`,
                    fontSize: `${fontSize}px`,
                    lineHeight: 1.5,
                  } as React.CSSProperties
                }
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
                  'sdk-line-numbers shrink-0 select-none border-r border-zinc-200 bg-zinc-50/60 py-4 pl-4 pr-3 text-right font-mono dark:border-zinc-800 dark:bg-zinc-900/40',
                  height === 'auto' ? '' : 'overflow-hidden',
                )}
                style={
                  {
                    '--sdk-font-size': `${fontSize}px`,
                    fontSize: `${fontSize}px`,
                    lineHeight: 1.5,
                  } as React.CSSProperties
                }
              >
                {Array.from({ length: lineCount }, (_, i) => (
                  <div key={i} className="tabular-nums text-zinc-400 dark:text-zinc-600">
                    {i + 1}
                  </div>
                ))}
              </div>
              {/* Code - fallback */}
              <pre
                ref={codeScrollRef as unknown as React.RefObject<HTMLPreElement>}
                className={cn(
                  'flex-1 py-4 pl-4 pr-4 text-zinc-800 dark:text-zinc-200 whitespace-pre font-mono overflow-x-auto',
                  height === 'auto' ? '' : 'overflow-y-auto',
                )}
                style={
                  {
                    '--sdk-font-size': `${fontSize}px`,
                    fontSize: `${fontSize}px`,
                    lineHeight: 1.5,
                    minWidth: 'max-content',
                  } as React.CSSProperties
                }
              >
                {activeSource?.code}
              </pre>
            </>
          )}
        </div>

        {/* Footer */}
        {activeSource?.description && (
          <div className="shrink-0 border-t border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <p className="text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">{activeSource.description}</p>
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
