'use client';

import { useCallback, useState } from 'react';
import { ArrowUpRight, Check, Copy, Download } from 'lucide-react';

export interface CliDownload {
  data: string;
  filename: string;
  label?: string;
}

const HEADER_LINK =
  'inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100';

/** The CLI a command runs in, named after its first word. */
const TOOLS = {
  'platform-cli': { name: 'platform-cli', docs: 'https://github.com/ava-labs/platform-cli' },
  cast: { name: 'cast', docs: 'https://getfoundry.sh/cast/reference/cast' },
} as const;

/** Splits a command into its base and `--flag value` pairs, keeping quoted values like "My Chain" whole. */
function parse(command: string) {
  const tokens = command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  const base: string[] = [];
  const flags: { flag: string; value?: string }[] = [];
  let i = 0;
  while (i < tokens.length && !tokens[i].startsWith('--')) base.push(tokens[i++]);
  while (i < tokens.length) {
    if (tokens[i].startsWith('--')) {
      const flag = tokens[i];
      const value = i + 1 < tokens.length && !tokens[i + 1].startsWith('--') ? tokens[++i] : undefined;
      flags.push({ flag, value });
    }
    i++;
  }
  return { base, flags };
}

function downloadFile({ data, filename }: CliDownload) {
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * The command-line fallback every console tool shows under its in-browser action: one board, the command with its
 * flags set apart, a copy button that is always there, and an optional file the command needs (a genesis, say).
 */
export function CliAlternative({ command, download }: { command: string; download?: CliDownload }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [command]);
  const { base, flags } = parse(command);
  const tool = TOOLS[base[0] as keyof typeof TOOLS] ?? TOOLS['platform-cli'];

  return (
    <div className="border border-zinc-200 bg-white/80 dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="flex min-h-9 items-center justify-between gap-4 border-b border-zinc-200 bg-zinc-50/80 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
          Or with {tool.name}
        </p>
        <span className="flex items-center gap-4">
          {download?.data && (
            <button type="button" onClick={() => downloadFile(download)} className={HEADER_LINK}>
              <Download className="h-3 w-3" />
              {download.label || download.filename}
            </button>
          )}
          <a href={tool.docs} target="_blank" rel="noopener noreferrer" className={HEADER_LINK}>
            Docs <ArrowUpRight className="h-3 w-3" />
          </a>
        </span>
      </div>
      <div className="flex items-start gap-3 px-4 py-3.5">
        <pre className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-[12.5px] leading-relaxed">
          <span className="select-none text-zinc-400 dark:text-zinc-600">$ </span>
          <span className="text-zinc-900 dark:text-zinc-50">{base.join(' ')}</span>
          {flags.map((f, i) => (
            <span key={i}>
              {' '}
              <span className="text-zinc-500 dark:text-zinc-400">{f.flag}</span>
              {f.value && (
                <>
                  {' '}
                  <span className="text-[#0061E2] dark:text-[#5f9dff]">{f.value}</span>
                </>
              )}
            </span>
          ))}
        </pre>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? 'Copied' : 'Copy command'}
          title={copied ? 'Copied' : 'Copy command'}
          className="-m-1 shrink-0 p-1 text-zinc-400 transition-colors hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-zinc-100"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
