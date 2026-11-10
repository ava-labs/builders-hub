'use client';

import { useState } from 'react';
import { KeyRound, Plus, Settings2, Upload } from 'lucide-react';
import { getAddress } from 'viem';
import { HashChip, MUTED } from '@/components/explorer-v2/ui';
import { NEED_TEXT, useConsoleSigner } from '@/lib/console-wallets/react';
import { lock } from '@/lib/console-wallets/vault';
import { cn } from '@/lib/utils';
import { Button, Notice, Pill } from '@/components/studio/ui';
import { ConsoleWalletsDialog, WalletDialogs, type WalletDialog } from './ConsoleWalletsManager';
import { BROWSER_ONLY_SHORT } from './flows';

const OPTION =
  'flex w-full items-center gap-3 border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60';
const ON = 'border-zinc-900 bg-zinc-50 dark:border-zinc-100 dark:bg-zinc-900/60';
const OFF = 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600';

function Radio({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border',
        on ? 'border-zinc-900 dark:border-zinc-100' : 'border-zinc-300 dark:border-zinc-700',
      )}
    >
      {on && <span className="h-1.5 w-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100" />}
    </span>
  );
}

/**
 * Choose who signs for a scope: the browser wallet, or a Console wallet that
 * signs without popups. A pinned address (work already signed by one wallet)
 * locks the choice to that wallet.
 */
export function WalletPicker({
  scope,
  pinnedAddress,
  pinnedReason = 'This deployment is already signed by this wallet, so it stays with it.',
}: {
  scope: string;
  pinnedAddress?: string | null;
  pinnedReason?: string;
}) {
  const state = useConsoleSigner(scope, { pinnedAddress });
  const [open, setOpen] = useState<WalletDialog>(null);
  const [manage, setManage] = useState(false);
  const pinned = state.pinned;

  return (
    <div className="flex flex-col gap-3">
      {pinned && <p className={cn(MUTED, 'text-[11.5px]')}>{pinnedReason}</p>}
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Signing wallet">
        {(!pinned || state.choice === 'browser') && (
          <button
            type="button"
            role="radio"
            aria-checked={state.choice === 'browser'}
            disabled={!!pinned}
            onClick={() => state.choose('browser')}
            className={cn(OPTION, state.choice === 'browser' ? ON : OFF)}
          >
            <Radio on={state.choice === 'browser'} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-zinc-900 dark:text-zinc-50">Browser wallet</span>
              <span className={cn(MUTED, 'block text-[11.5px]')}>
                Core, MetaMask or another extension. You confirm every transaction.
              </span>
            </span>
            {state.browserAddress ? <HashChip value={state.browserAddress} len={6} /> : <Pill>not connected</Pill>}
          </button>
        )}
        {state.wallets
          .filter((w) => !pinned || getAddress(w.address) === pinned)
          .map((w) => {
            const on = state.choice === w.id;
            return (
              <div key={w.id} className={cn(OPTION, 'p-0', on ? ON : OFF)}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={!!pinned}
                  onClick={() => state.choose(w.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left disabled:cursor-default"
                >
                  <Radio on={on} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-50">
                        {w.label}
                      </span>
                      <Pill tone="info">console wallet</Pill>
                      {!w.backedUp && <Pill tone="warn">not backed up</Pill>}
                    </span>
                    <span className={cn(MUTED, 'block text-[11.5px]')}>Signs without popups while unlocked.</span>
                  </span>
                  <HashChip value={w.address} len={6} />
                </button>
                <span className="flex shrink-0 items-center gap-2 pr-4">
                  {!w.backedUp && (
                    <Button
                      variant="ghost"
                      className="h-7 px-1.5 text-amber-700 dark:text-amber-300"
                      onClick={() => setOpen({ kind: 'show', wallet: w })}
                    >
                      Save key
                    </Button>
                  )}
                  {w.unlocked ? (
                    <Button variant="ghost" className="h-7 px-1.5" onClick={() => lock(w.id)}>
                      Lock
                    </Button>
                  ) : (
                    <Button variant="secondary" className="h-7" onClick={() => setOpen({ kind: 'unlock', wallet: w })}>
                      Unlock
                    </Button>
                  )}
                </span>
              </div>
            );
          })}
      </div>

      {!pinned && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setOpen({ kind: 'create' })}>
            <Plus className="h-3.5 w-3.5" /> Create Console wallet
          </Button>
          <Button variant="ghost" onClick={() => setOpen({ kind: 'import' })}>
            <Upload className="h-3.5 w-3.5" /> Import key
          </Button>
          {state.wallets.length > 0 && (
            <Button variant="ghost" onClick={() => setManage(true)}>
              <Settings2 className="h-3.5 w-3.5" /> Manage wallets
            </Button>
          )}
        </div>
      )}
      <p className="flex items-center gap-1.5 font-mono text-[11px] text-amber-700 dark:text-amber-300">
        <KeyRound className="h-3 w-3" /> Console wallets: {BROWSER_ONLY_SHORT}
      </p>

      {state.ready && state.needs && state.needs !== 'choose' && <Notice tone="warn">{NEED_TEXT[state.needs]}</Notice>}

      <WalletDialogs open={open} setOpen={setOpen} onCreated={(w) => !pinned && state.choose(w.id)} />
      {manage && <ConsoleWalletsDialog onClose={() => setManage(false)} />}
    </div>
  );
}
