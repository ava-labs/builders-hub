'use client';

import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { RawInput } from '@/components/toolbox/components/Input';
import { Button } from '@/components/toolbox/components/Button';
import { Alert } from '@/components/toolbox/components/Alert';
import { Bone, CopyValue, EYEBROW, Loading } from '@/components/toolbox/console/icm/ui';

interface RelayerFundingProps {
  relayerAddress: string | null;
  selectedChains: L1ListItem[];
  balances: Record<string, string>;
  isLoadingBalances: boolean;
  isSending: boolean;
  tokenAmounts: Record<string, string>;
  onRefreshBalances: () => void;
  onSendCoins: (chainId: string) => void;
  onUpdateTokenAmount: (chainId: string, amount: string) => void;
  onFocusAddress?: () => void;
  onBlurAddress?: () => void;
}

export function RelayerFunding({
  relayerAddress,
  selectedChains,
  balances,
  isLoadingBalances,
  isSending,
  tokenAmounts,
  onRefreshBalances,
  onSendCoins,
  onUpdateTokenAmount,
  onFocusAddress,
  onBlurAddress,
}: RelayerFundingProps) {
  return (
    <section className="flex flex-col border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div
        className="flex flex-col gap-2 px-5 py-4"
        tabIndex={relayerAddress ? 0 : -1}
        onFocus={onFocusAddress}
        onBlur={onBlurAddress}
        onMouseEnter={onFocusAddress}
        onMouseLeave={onBlurAddress}
      >
        <p className={EYEBROW}>Relayer address</p>
        {relayerAddress ? <CopyValue value={relayerAddress} /> : <Bone className="h-4 w-80 max-w-full" />}
      </div>

      <div className="px-5 pb-4">
        <Alert variant="warning">
          This address uses a temporary key generated in your browser. It lives in session storage and is{' '}
          <strong className="font-semibold">lost when you close this tab</strong>. You can swap in your own key in the
          config file (<code className="font-mono text-[12px]">account-private-key</code> on every destination). Fund
          the address well enough to cover fees.
        </Alert>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-zinc-200 px-5 pb-1 pt-4 dark:border-zinc-800">
        <p className={EYEBROW}>Fund the relayer</p>
        <button
          type="button"
          onClick={onRefreshBalances}
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

      {selectedChains.length === 0 ? (
        <p className="border-t border-zinc-200 px-5 py-4 text-[13px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Pick a source and a destination chain to see balances here.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 border-t border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {selectedChains.map((chain: L1ListItem) => {
            const amountId = `relayer-fund-${chain.id}`;
            return (
              <li
                key={`balance-${chain.id}`}
                className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-medium text-zinc-900 dark:text-zinc-50">{chain.name}</p>
                  {balances[chain.id] !== undefined ? (
                    <p className="font-mono text-[12.5px] tabular-nums text-zinc-600 dark:text-zinc-300">
                      {balances[chain.id]} {chain.coinName}
                    </p>
                  ) : isLoadingBalances ? (
                    <Loading>Reading balance…</Loading>
                  ) : (
                    <p className="font-mono text-[12.5px] tabular-nums text-zinc-400 dark:text-zinc-500">
                      0 {chain.coinName}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor={amountId} className="sr-only">
                    Amount of {chain.coinName} to send
                  </label>
                  <RawInput
                    id={amountId}
                    value={tokenAmounts[chain.id] || '1'}
                    onChange={(e) => onUpdateTokenAmount(chain.id, e.target.value)}
                    placeholder="1.0"
                    type="number"
                    step="0.1"
                    min="0"
                    className="h-8 w-24 text-right font-mono tabular-nums"
                  />
                  <Button
                    size="sm"
                    variant="primary"
                    className="w-28 shrink-0"
                    onClick={() => onSendCoins(chain.id)}
                    loading={isSending}
                    loadingText="Sending"
                  >
                    Send {chain.coinName}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
