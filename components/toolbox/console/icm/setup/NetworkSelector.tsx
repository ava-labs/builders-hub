'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { CELL_GRID, CHOSEN } from '@/components/toolbox/console/icm/ui';

interface NetworkSelectorProps {
  l1List: L1ListItem[];
  selectedNetworks: string[];
  onToggle: (l1Id: string) => void;
  title: string;
  idPrefix: string;
  /** Position in the source → destination pair, shown as the red index. */
  n?: number;
  hint?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

function ChainMark({ l1 }: { l1: L1ListItem }) {
  return (
    <span
      aria-hidden
      className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
    >
      {l1.logoUrl ? (
        <img src={l1.logoUrl} alt="" className="h-full w-full object-contain p-0.5" />
      ) : (
        <span className="font-mono text-[11px] font-bold uppercase text-zinc-500 dark:text-zinc-400">
          {l1.name.charAt(0)}
        </span>
      )}
    </span>
  );
}

/** A column of chain cells; several can be ticked at once. */
export function NetworkSelector({
  l1List,
  selectedNetworks,
  onToggle,
  title,
  idPrefix,
  n,
  hint,
  onMouseEnter,
  onMouseLeave,
}: NetworkSelectorProps) {
  return (
    <section className="flex min-w-0 flex-col gap-3" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-3">
          {n !== undefined && (
            <span className="font-mono text-[11px] font-bold tabular-nums text-[#E6212F]">
              {String(n).padStart(2, '0')}
            </span>
          )}
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-900 dark:text-zinc-100">
            {title}
          </span>
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-zinc-400 dark:text-zinc-500">
            {selectedNetworks.length} picked
          </span>
        </p>
        {hint && <p className="text-[13px] text-zinc-500 dark:text-zinc-400">{hint}</p>}
      </div>
      <div role="group" aria-label={title} className={cn(CELL_GRID, 'grid-cols-1')}>
        {l1List.map((l1: L1ListItem) => {
          const checked = selectedNetworks.includes(l1.id);
          return (
            <button
              key={`${idPrefix}-${l1.id}`}
              id={`${idPrefix}-${l1.id}`}
              type="button"
              role="checkbox"
              aria-checked={checked}
              onClick={() => onToggle(l1.id)}
              className={cn(
                'group/opt relative flex items-center gap-3 bg-white px-4 py-3 text-left dark:bg-zinc-950',
                checked && CHOSEN,
              )}
            >
              <ChainMark l1={l1} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-zinc-900 decoration-zinc-400 underline-offset-4 group-hover/opt:underline dark:text-zinc-50 dark:decoration-zinc-500">
                  {l1.name}
                </span>
                <span className="block font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
                  Chain ID {l1.evmChainId}
                </span>
              </span>
              <span
                aria-hidden
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center border transition-colors',
                  checked
                    ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                    : 'border-zinc-300 group-hover/opt:border-zinc-500 dark:border-zinc-700 dark:group-hover/opt:border-zinc-500',
                )}
              >
                {checked && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
