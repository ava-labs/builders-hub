'use client';

import { Copy, Check } from 'lucide-react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { DocsLink, EYEBROW } from '@/components/toolbox/console/icm/ui';

interface ConfigPreviewProps {
  configJson: string;
  highlightedLines: number[];
}

const KEY_LINE = /^(\s*)("(?:[^"\\]|\\.)*")(\s*:\s*)(.*)$/;

function valueClass(value: string) {
  if (value.startsWith('"0x')) return 'text-[#0061E2] dark:text-[#5f9dff]';
  if (value.startsWith('"')) return 'text-zinc-600 dark:text-zinc-300';
  if (/^(true|false|null|-?\d)/.test(value)) return 'text-violet-700 dark:text-violet-300';
  return 'text-zinc-400 dark:text-zinc-500';
}

function JsonLine({ line }: { line: string }) {
  const m = line.match(KEY_LINE);
  if (!m) return <span className="text-zinc-400 dark:text-zinc-500">{line}</span>;
  const [, indent, key, sep, value] = m;
  return (
    <>
      {indent}
      <span className="text-zinc-900 dark:text-zinc-50">{key}</span>
      <span className="text-zinc-400 dark:text-zinc-500">{sep}</span>
      <span className={valueClass(value)}>{value}</span>
    </>
  );
}

export function ConfigPreview({ configJson, highlightedLines }: ConfigPreviewProps) {
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleCopy = useCallback(async () => {
    if (!configJson) return;
    await navigator.clipboard.writeText(configJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [configJson]);

  // Bring the first highlighted line into view inside the preview only, never scrolling the page.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container || highlightedLines.length === 0) return;
    const first = Math.min(...highlightedLines);
    const el = container.querySelector<HTMLElement>(`[data-line="${first}"]`);
    if (!el) return;
    const top = el.offsetTop;
    if (top < container.scrollTop || top > container.scrollTop + container.clientHeight - 40) {
      container.scrollTo({ top: Math.max(0, top - container.clientHeight / 2), behavior: 'smooth' });
    }
  }, [highlightedLines]);

  const highlighted = new Set(highlightedLines);
  const lines = configJson ? configJson.split('\n') : [];

  return (
    <div className="flex h-[600px] flex-col border border-zinc-200 bg-zinc-50 xl:sticky xl:top-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex min-h-9 shrink-0 items-center justify-between gap-4 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <p className="flex min-w-0 items-baseline gap-3">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-900 dark:text-zinc-100">
            config.json
          </span>
          <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
            Relayer
          </span>
        </p>
        <button
          type="button"
          onClick={handleCopy}
          disabled={!configJson}
          aria-label={copied ? 'Copied' : 'Copy configuration'}
          className="-m-1 inline-flex items-center gap-1.5 p-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-900 disabled:opacity-40 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div ref={scrollRef} className="relative flex-1 overflow-auto py-3">
        {configJson ? (
          <pre className="font-mono text-[11.5px] leading-5">
            {lines.map((line, i) => {
              const n = i + 1;
              const on = highlighted.has(n);
              return (
                <div
                  key={n}
                  data-line={n}
                  className={cn(
                    'flex border-l-2 pr-4 whitespace-pre-wrap [overflow-wrap:anywhere]',
                    on ? 'border-zinc-900 dark:border-zinc-100' : 'border-transparent',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'w-10 shrink-0 select-none pr-3 text-right tabular-nums',
                      on ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-300 dark:text-zinc-700',
                    )}
                  >
                    {n}
                  </span>
                  <span className="min-w-0 flex-1">
                    <JsonLine line={line} />
                  </span>
                </div>
              );
            })}
          </pre>
        ) : (
          <div className="flex h-full flex-col items-start justify-center gap-2 px-6">
            <p className={EYEBROW}>No config yet</p>
            <p className="max-w-xs text-[13px] text-zinc-500 dark:text-zinc-400">
              Pick at least one source and one destination chain to generate it.
            </p>
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
        <p className="text-[11.5px] text-zinc-500 dark:text-zinc-400">Hover a field to mark its lines here.</p>
        <DocsLink href="https://github.com/ava-labs/awm-relayer">Relayer repo</DocsLink>
      </div>
    </div>
  );
}
