'use client';

import { useState } from 'react';
import { KeyRound, Lock, Plus, Upload } from 'lucide-react';
import { HashChip, MUTED } from '@/components/explorer-v2/ui';
import { useConsoleWallets } from '@/lib/console-wallets/react';
import { lock, lockAll, type WalletInfo } from '@/lib/console-wallets/vault';
import { cn } from '@/lib/utils';
import { Button, Notice, Pill } from '@/components/studio/ui';
import { TESTNET_CHAINS } from './chains';
import { Dialog } from './Dialog';
import { FundWallet } from './FundWallet';
import {
  BROWSER_ONLY_SHORT,
  ChangePinDialog,
  CreateWalletDialog,
  DeleteWalletDialog,
  ImportWalletDialog,
  RenameDialog,
  ShowKeyDialog,
  UnlockDialog,
} from './flows';

export type WalletDialog =
  | { kind: 'create' }
  | { kind: 'import' }
  | { kind: 'unlock' | 'show' | 'pin' | 'rename' | 'delete' | 'fund'; wallet: WalletInfo }
  | null;

/** Renders whichever wallet dialog is open; shared by the manager and the picker. */
export function WalletDialogs({
  open,
  setOpen,
  onCreated,
}: {
  open: WalletDialog;
  setOpen: (d: WalletDialog) => void;
  onCreated?: (w: WalletInfo) => void;
}) {
  const close = () => setOpen(null);
  if (!open) return null;
  switch (open.kind) {
    case 'create':
      return <CreateWalletDialog onClose={close} onCreated={onCreated} />;
    case 'import':
      return <ImportWalletDialog onClose={close} onCreated={onCreated} />;
    case 'unlock':
      return <UnlockDialog wallet={open.wallet} onClose={close} />;
    case 'show':
      return <ShowKeyDialog wallet={open.wallet} onClose={close} />;
    case 'pin':
      return <ChangePinDialog wallet={open.wallet} onClose={close} />;
    case 'rename':
      return <RenameDialog wallet={open.wallet} onClose={close} />;
    case 'fund':
      return (
        <Dialog title={`Fund ${open.wallet.label}`} onClose={close} wide>
          <p className="text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300">
            Balances on Builder Hub&apos;s testnets. A Studio project shows the exact chains and amounts its plan needs.
          </p>
          <FundWallet address={open.wallet.address} chains={TESTNET_CHAINS} />
        </Dialog>
      );
    case 'delete':
      return (
        <DeleteWalletDialog
          wallet={open.wallet}
          onClose={close}
          onShowKey={() => setOpen({ kind: 'show', wallet: open.wallet })}
        />
      );
  }
}

const TEXT_ACTION =
  'font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100';

export function WalletRow({
  wallet,
  onOpen,
  actions = true,
}: {
  wallet: WalletInfo;
  onOpen: (d: WalletDialog) => void;
  actions?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 px-5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 truncate text-[13px] font-medium text-zinc-900 dark:text-zinc-50">{wallet.label}</span>
        <HashChip value={wallet.address} len={6} />
        {wallet.unlocked ? <Pill tone="good">unlocked</Pill> : <Pill>locked</Pill>}
        {!wallet.backedUp && <Pill tone="warn">not backed up</Pill>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {wallet.unlocked ? (
            <button type="button" className={TEXT_ACTION} onClick={() => lock(wallet.id)}>
              Lock
            </button>
          ) : (
            <button type="button" className={TEXT_ACTION} onClick={() => onOpen({ kind: 'unlock', wallet })}>
              Unlock
            </button>
          )}
          <button
            type="button"
            className={cn(TEXT_ACTION, !wallet.backedUp && 'text-amber-700 dark:text-amber-300')}
            onClick={() => onOpen({ kind: 'show', wallet })}
          >
            {wallet.backedUp ? 'Show private key' : 'Save private key'}
          </button>
          <button type="button" className={TEXT_ACTION} onClick={() => onOpen({ kind: 'fund', wallet })}>
            Fund
          </button>
          <button type="button" className={TEXT_ACTION} onClick={() => onOpen({ kind: 'rename', wallet })}>
            Rename
          </button>
          <button type="button" className={TEXT_ACTION} onClick={() => onOpen({ kind: 'pin', wallet })}>
            Change PIN
          </button>
          <button
            type="button"
            className={cn(TEXT_ACTION, 'hover:text-red-600 dark:hover:text-red-400')}
            onClick={() => onOpen({ kind: 'delete', wallet })}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export function ConsoleWalletsManager() {
  const { wallets, ready, error } = useConsoleWallets();
  const [open, setOpen] = useState<WalletDialog>(null);
  const anyUnlocked = wallets.some((w) => w.unlocked);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300">
        Console wallets sign transactions without a wallet popup each time. Each one is encrypted with its own PIN.
      </p>
      <p className={cn(MUTED, 'flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300')}>
        <KeyRound className="h-3 w-3" /> {BROWSER_ONLY_SHORT}
      </p>
      {error && <Notice tone="bad">{error}</Notice>}
      <div className="flex flex-col divide-y divide-zinc-200 border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {!ready ? (
          <p className={cn(MUTED, 'px-5 py-3 text-[12px]')}>Loading…</p>
        ) : wallets.length === 0 ? (
          <p className={cn(MUTED, 'px-5 py-3 text-[12px]')}>No Console wallets in this browser yet.</p>
        ) : (
          wallets.map((w) => <WalletRow key={w.id} wallet={w} onOpen={setOpen} />)
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setOpen({ kind: 'create' })}>
          <Plus className="h-3.5 w-3.5" /> Create wallet
        </Button>
        <Button variant="secondary" onClick={() => setOpen({ kind: 'import' })}>
          <Upload className="h-3.5 w-3.5" /> Import key
        </Button>
        {anyUnlocked && (
          <Button variant="ghost" onClick={() => lockAll()}>
            <Lock className="h-3.5 w-3.5" /> Lock all
          </Button>
        )}
        {!anyUnlocked && wallets.length > 0 && (
          <span className={cn(MUTED, 'inline-flex items-center gap-1.5 text-[11px]')}>
            <Lock className="h-3 w-3" /> All locked
          </span>
        )}
      </div>
      <WalletDialogs open={open} setOpen={setOpen} />
    </div>
  );
}

export function ConsoleWalletsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Console wallets" onClose={onClose} wide>
      <ConsoleWalletsManager />
    </Dialog>
  );
}
