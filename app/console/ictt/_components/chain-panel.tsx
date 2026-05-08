'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/components/toolbox/lib/utils';
import { chainColor, chainInitial } from './chain-color';
import { ContractRow } from './contract-row';
import type { ContractSlot } from './types';
import type { L1ListItem } from '@/components/toolbox/stores/l1ListStore';

interface ChainPanelProps {
  chain: L1ListItem | undefined;
  role: string;
  contracts: ContractSlot[];
  dim: boolean;
  walletConnected: boolean;
  expandedDetails?: ReactNode;
  initiallyExpanded?: boolean;
}

/**
 * Left or right pane of the bridge. Shows a chain header with role label
 * and connected indicator, contract rows, and an optional expanded details
 * slot. Each panel keeps its OWN expand state — the design has a single
 * shared `forceExpanded` boolean which makes both sides flip together;
 * we deliberately split that so users can peek at one without opening
 * both.
 */
export function ChainPanel({
  chain,
  role,
  contracts,
  dim,
  walletConnected,
  expandedDetails,
  initiallyExpanded = false,
}: ChainPanelProps) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const color = chainColor(chain?.id);
  const name = chain?.name ?? '—';

  return (
    <div
      className={cn(
        'relative flex-1 rounded-2xl border bg-white dark:bg-zinc-950 transition-opacity',
        'border-zinc-200 dark:border-zinc-800 overflow-hidden',
        dim && 'opacity-50',
      )}
    >
      {/* Top accent strip in the chain's color */}
      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: color }} />

      <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-lg grid place-items-center text-white text-xs font-bold flex-shrink-0"
            style={{ background: color }}
          >
            {chainInitial(name)}
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-semibold">
              {role}
            </div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{name}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {walletConnected && (
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              connected
            </div>
          )}
          {expandedDetails && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-[10px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer px-1.5 py-0.5 rounded border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
            >
              {expanded ? '– collapse' : '+ details'}
            </button>
          )}
        </div>
      </div>

      <div className="px-5 pb-4 space-y-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-semibold mb-1.5">
            Contracts
          </div>
          {contracts.map((c) => (
            <ContractRow
              key={c.label}
              label={c.label}
              address={c.address}
              status={c.status}
              explorerUrl={chain?.explorerUrl}
            />
          ))}
        </div>
        {expanded && expandedDetails && <div className="space-y-3">{expandedDetails}</div>}
      </div>
    </div>
  );
}
