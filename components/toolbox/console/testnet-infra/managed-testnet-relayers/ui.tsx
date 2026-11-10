'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, ArrowRight, Check, Info, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AvaxLogo } from '@/components/toolbox/console/create-l1/icons';
import type { L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import type { RelayerConfig } from './types';

export const EYEBROW = 'font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400';
export const COUNT = 'font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-zinc-400 dark:text-zinc-500';

const BTN =
  'group/btn inline-flex h-9 shrink-0 items-center justify-center gap-2 border px-4 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-50';
export const BTN_PRIMARY = cn(
  BTN,
  'border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-700 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300',
);
export const BTN_SECONDARY = cn(
  BTN,
  'border-zinc-300 text-zinc-700 hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-100 dark:hover:text-zinc-50',
);
export const BTN_DANGER = cn(
  BTN,
  'border-red-200 bg-red-50 text-red-700 hover:border-red-500 hover:bg-red-100 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300 dark:hover:border-red-700',
);

/** The red accent arrow that slides in when its button is hovered. */
export function HoverArrow() {
  return (
    <ArrowRight className="h-3.5 w-3.5 -translate-x-1 text-[#E6212F] opacity-0 transition-all group-hover/btn:translate-x-0 group-hover/btn:opacity-100 group-disabled/btn:hidden" />
  );
}

export const C_CHAIN_SUBNET_ID = '11111111111111111111111111111111LpoYY';

export type ChainInfo = { name: string; coinName: string; logoUrl?: string; isCChain: boolean };

/** Name, coin and logo for a relayer config: the C-Chain, a known L1, or a short blockchain ID. */
export function resolveChainInfo(config: RelayerConfig, l1List: L1ListItem[]): ChainInfo {
  if (config.rpcUrl.includes('avax-test.network') || config.subnetId === C_CHAIN_SUBNET_ID) {
    return { name: 'C-Chain (Fuji)', coinName: 'AVAX', isCChain: true };
  }
  const l1 = l1List.find((item) => item.id === config.blockchainId);
  if (l1) return { name: l1.name, coinName: l1.coinName, logoUrl: l1.logoUrl, isCChain: false };
  return { name: `${config.blockchainId.substring(0, 8)}...`, coinName: 'Token', isCChain: false };
}

/** A chain's logo in a small square: the Avalanche mark for the C-Chain, the L1's logo, or its initial. */
export function ChainMark({
  name,
  logoUrl,
  isCChain = false,
  size = 'h-7 w-7',
}: {
  name: string;
  logoUrl?: string;
  isCChain?: boolean;
  size?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950',
        size,
      )}
    >
      {isCChain ? (
        <AvaxLogo className="h-3.5 w-3.5 text-[#E6212F]" />
      ) : logoUrl ? (
        <img src={logoUrl} alt="" className="h-full w-full object-contain p-0.5" />
      ) : (
        <span className="font-mono text-[11px] font-bold uppercase text-zinc-500 dark:text-zinc-400">
          {name.charAt(0)}
        </span>
      )}
    </span>
  );
}

export function Notice({ tone, children }: { tone: 'warn' | 'error' | 'info'; children: ReactNode }) {
  const Icon = tone === 'error' ? XCircle : tone === 'warn' ? AlertTriangle : Info;
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={cn(
        'flex items-start gap-3 border px-4 py-3 text-[13px] leading-relaxed',
        tone === 'error' &&
          'border-red-200 bg-red-50 text-red-800 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-200',
        tone === 'warn' &&
          'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/20 dark:text-amber-200',
        tone === 'info' &&
          'border-zinc-200 bg-white text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300',
      )}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', tone === 'info' && 'text-zinc-400')} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** One L1 in a chain picker: a hairline cell, outlined in ink when ticked. Several can be ticked at once. */
function ChainOption({ l1, checked, onToggle }: { l1: L1ListItem; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={cn(
        'group/opt relative flex items-center gap-3 bg-white px-4 py-3 text-left transition-colors dark:bg-zinc-950',
        checked
          ? 'z-10 outline outline-2 -outline-offset-2 outline-zinc-900 dark:outline-zinc-100'
          : 'hover:outline hover:outline-1 hover:-outline-offset-1 hover:outline-zinc-400 dark:hover:outline-zinc-600',
      )}
    >
      <ChainMark name={l1.name} logoUrl={l1.logoUrl} isCChain={l1.subnetId === C_CHAIN_SUBNET_ID} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-zinc-900 dark:text-zinc-50">{l1.name}</span>
        <span className="block font-mono text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
          Chain ID {l1.evmChainId}
        </span>
      </span>
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center border',
          checked
            ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
            : 'border-zinc-300 dark:border-zinc-700',
        )}
      >
        {checked && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
      </span>
    </button>
  );
}

function ChainColumn({
  n,
  title,
  hint,
  l1List,
  selected,
  onToggle,
}: {
  n: number;
  title: string;
  hint: string;
  l1List: L1ListItem[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-3">
          <span className="font-mono text-[11px] font-bold tabular-nums text-[#E6212F]">
            {String(n).padStart(2, '0')}
          </span>
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-900 dark:text-zinc-100">
            {title}
          </span>
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          <span className={COUNT}>{selected.length} picked</span>
        </p>
        <p className="text-[13px] text-zinc-500 dark:text-zinc-400">{hint}</p>
      </div>
      <div
        role="group"
        aria-label={title}
        className="grid grid-cols-1 gap-px border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800"
      >
        {l1List.map((l1) => (
          <ChainOption
            key={`${title}-${l1.id}`}
            l1={l1}
            checked={selected.includes(l1.id)}
            onToggle={() => onToggle(l1.id)}
          />
        ))}
      </div>
    </section>
  );
}

export function NoChains() {
  return (
    <div className="flex flex-col items-start gap-2 border border-zinc-200 bg-white/80 px-5 py-6 dark:border-zinc-800 dark:bg-zinc-950/80">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        No L1s in your list yet
      </p>
      <p className="text-[13px] text-zinc-500 dark:text-zinc-400">Create an L1 first, then set up a relayer for it.</p>
    </div>
  );
}

/** Source and destination pickers side by side, each a column of chain cells. */
export function ChainPicker({
  l1List,
  sources,
  destinations,
  onToggleSource,
  onToggleDestination,
}: {
  l1List: L1ListItem[];
  sources: string[];
  destinations: string[];
  onToggleSource: (id: string) => void;
  onToggleDestination: (id: string) => void;
}) {
  if (l1List.length === 0) return <NoChains />;
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <ChainColumn
        n={1}
        title="Source"
        hint="Chains the relayer watches for messages."
        l1List={l1List}
        selected={sources}
        onToggle={onToggleSource}
      />
      <ChainColumn
        n={2}
        title="Destination"
        hint="Chains the relayer delivers messages to."
        l1List={l1List}
        selected={destinations}
        onToggle={onToggleDestination}
      />
    </div>
  );
}

function ChainNames({ ids, l1List }: { ids: string[]; l1List: L1ListItem[] }) {
  const chains = l1List.filter((l1) => ids.includes(l1.id));
  if (chains.length === 0) return <span className="text-zinc-400 dark:text-zinc-500">None</span>;
  return (
    <span className="flex flex-wrap justify-end gap-x-3 gap-y-1.5">
      {chains.map((l1) => (
        <span key={l1.id} className="inline-flex items-center gap-1.5">
          <ChainMark name={l1.name} logoUrl={l1.logoUrl} isCChain={l1.subnetId === C_CHAIN_SUBNET_ID} size="h-4 w-4" />
          {l1.name}
        </span>
      ))}
    </span>
  );
}

/** What the relayer will do, read back before it is created. */
export function SelectionSummary({
  l1List,
  sources,
  destinations,
}: {
  l1List: L1ListItem[];
  sources: string[];
  destinations: string[];
}) {
  const total = new Set([...sources, ...destinations]).size;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 px-5 py-4 text-[13px]">
      <dt className="text-zinc-500 dark:text-zinc-400">From</dt>
      <dd className="text-right font-medium text-zinc-900 dark:text-zinc-50">
        <ChainNames ids={sources} l1List={l1List} />
      </dd>
      <dt className="text-zinc-500 dark:text-zinc-400">To</dt>
      <dd className="text-right font-medium text-zinc-900 dark:text-zinc-50">
        <ChainNames ids={destinations} l1List={l1List} />
      </dd>
      <dt className="text-zinc-500 dark:text-zinc-400">Chains to fund</dt>
      <dd className="text-right font-mono tabular-nums text-zinc-900 dark:text-zinc-50">{total}</dd>
      <dt className="text-zinc-500 dark:text-zinc-400">Lifetime</dt>
      <dd className="text-right font-mono tabular-nums text-zinc-900 dark:text-zinc-50">3 days</dd>
    </dl>
  );
}

/** Below this, the relayer may run out of gas mid-delivery; the row turns amber. */
const LOW_BALANCE = 0.1;

/** The relayer's balance on each chain it serves, with an amount field and a send button per chain. */
export function BalanceRows({
  configs,
  chainInfo,
  balances,
  isLoadingBalances,
  onRefresh,
  tokenAmounts,
  onAmountChange,
  onSend,
  isSending,
}: {
  configs: RelayerConfig[];
  chainInfo: (config: RelayerConfig) => ChainInfo;
  balances: Record<string, string>;
  isLoadingBalances: boolean;
  onRefresh: () => void;
  tokenAmounts: Record<string, string>;
  onAmountChange: (blockchainId: string, amount: string) => void;
  onSend: (config: RelayerConfig) => void;
  isSending: boolean;
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-4 px-5 pb-1 pt-4">
        <p className={EYEBROW}>Balances</p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoadingBalances}
          className="-m-1.5 inline-flex items-center gap-1.5 p-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500 transition-colors hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <RefreshCw className={cn('h-3 w-3', isLoadingBalances && 'animate-spin')} />
          Refresh
        </button>
      </div>
      <p className="px-5 pb-3 text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        The relayer pays gas on every chain it serves. Keep each balance above zero.
      </p>
      <ul className="divide-y divide-zinc-200 border-t border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {configs.map((config) => {
          const info = chainInfo(config);
          const raw = balances[config.blockchainId];
          const value = raw === undefined || raw === 'Error' ? null : parseFloat(raw);
          const low = value !== null && value < LOW_BALANCE;
          const amountId = `fund-${config.blockchainId}`;
          return (
            <li
              key={config.blockchainId}
              className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <ChainMark name={info.name} logoUrl={info.logoUrl} isCChain={info.isCChain} />
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium text-zinc-900 dark:text-zinc-50">{info.name}</p>
                  {raw === undefined ? (
                    <p className="font-mono text-[12px] text-zinc-400 dark:text-zinc-500">Loading…</p>
                  ) : raw === 'Error' ? (
                    <p className="text-[12px] text-red-600 dark:text-red-400">
                      Couldn&apos;t read the balance: the chain&apos;s RPC didn&apos;t answer.
                    </p>
                  ) : (
                    <p
                      className={cn(
                        'flex items-center gap-1.5 font-mono text-[12.5px] tabular-nums',
                        low ? 'text-amber-700 dark:text-amber-300' : 'text-zinc-600 dark:text-zinc-300',
                      )}
                    >
                      {low && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
                      {value!.toFixed(4)} {info.coinName}
                      {low && <span className="sr-only">(low balance)</span>}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor={amountId} className="sr-only">
                  Amount of {info.coinName} to send
                </label>
                <input
                  id={amountId}
                  value={tokenAmounts[config.blockchainId] || '1'}
                  onChange={(e) => onAmountChange(config.blockchainId, e.target.value)}
                  placeholder="1.0"
                  type="number"
                  step="0.1"
                  min="0"
                  className="h-9 w-24 border border-zinc-300 bg-white px-2.5 text-right font-mono text-[13px] tabular-nums text-zinc-900 transition-colors hover:border-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-100"
                />
                <button
                  type="button"
                  onClick={() => onSend(config)}
                  disabled={isSending}
                  className={cn(BTN_PRIMARY, 'min-w-28')}
                >
                  {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {isSending ? 'Sending' : `Send ${info.coinName}`}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
