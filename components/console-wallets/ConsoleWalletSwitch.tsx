'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { KeyRound, Lock, Plus, Settings2, Upload } from 'lucide-react';
import { useAccount, useAccountEffect, useConnect, useDisconnect } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import {
  CONSOLE_WALLET_CONNECTOR_ID,
  OPEN_CONSOLE_WALLETS_EVENT,
  UNLOCK_CANCELLED_EVENT,
  UNLOCK_REQUEST_EVENT,
  getActiveConsoleWallet,
  setActiveConsoleWallet,
  subscribeActiveConsoleWallet,
} from '@/lib/console-wallets/core-provider';
import { useConsoleWallets } from '@/lib/console-wallets/react';
import { lock } from '@/lib/console-wallets/vault';
import { cn } from '@/lib/utils';
import { ConsoleWalletsDialog, WalletDialogs, type WalletDialog } from './ConsoleWalletsManager';
import { BROWSER_ONLY_SHORT } from './flows';
import { HEADER_CHIP } from '@/components/toolbox/components/console-header/chip';

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

/**
 * The console's wallet switch in the top bar. On, the console connects the chosen Console wallet and every tool
 * signs with it (EVM and P-Chain) without prompts; off, it hands signing back to the browser wallet. A locked
 * wallet stays connected with its addresses and balances, and asks for its PIN when something needs a signature.
 */
export function ConsoleWalletSwitch() {
  const activeId = useSyncExternalStore(subscribeActiveConsoleWallet, getActiveConsoleWallet, () => null);
  const { wallets, ready } = useConsoleWallets();
  const { connector, isConnected } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const [dialog, setDialog] = useState<WalletDialog>(null);
  const [manage, setManage] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connecting = useRef(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_CONSOLE_WALLETS_EVENT, show);
    return () => window.removeEventListener(OPEN_CONSOLE_WALLETS_EVENT, show);
  }, []);

  const active = wallets.find((w) => w.id === activeId) ?? null;
  const on = !!activeId;
  const usingConsole = connector?.id === CONSOLE_WALLET_CONNECTOR_ID;

  // Connecting a browser wallet yourself hands signing back to it.
  useAccountEffect({
    onConnect({ connector: next, isReconnected }) {
      if (!isReconnected && next.id !== CONSOLE_WALLET_CONNECTOR_ID && getActiveConsoleWallet()) {
        setActiveConsoleWallet(null);
      }
    },
  });

  // The switch is the source of truth: while it's on, the console uses the chosen wallet or nothing (locked), never
  // the browser wallet, so balances and signing can't come from a different address. Off disconnects it.
  useEffect(() => {
    const consoleConnector = connectors.find((c) => c.id === CONSOLE_WALLET_CONNECTOR_ID);
    if (!consoleConnector || !ready) return;
    if (on && isConnected && !usingConsole) {
      void disconnectAsync().catch(() => {});
    } else if (active && !usingConsole && !connecting.current) {
      connecting.current = true;
      void connectAsync({ connector: consoleConnector })
        .then(() => setError(null))
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => (connecting.current = false));
    } else if (!on && usingConsole) {
      void disconnectAsync().catch(() => {});
    }
  }, [active, connectAsync, connectors, disconnectAsync, isConnected, on, ready, usingConsole]);

  // A tool asked the locked wallet to sign: prompt for the PIN, and reject the request if the prompt is dismissed.
  useEffect(() => {
    const ask = () => {
      if (!active) return window.dispatchEvent(new Event(UNLOCK_CANCELLED_EVENT));
      setOpen(false);
      setDialog({ kind: 'unlock', wallet: active });
    };
    window.addEventListener(UNLOCK_REQUEST_EVENT, ask);
    return () => window.removeEventListener(UNLOCK_REQUEST_EVENT, ask);
  }, [active]);

  const changeDialog = (next: WalletDialog) => {
    if (!next && dialog?.kind === 'unlock') window.dispatchEvent(new Event(UNLOCK_CANCELLED_EVENT));
    setDialog(next);
  };

  const choose = (id: string) => {
    setActiveConsoleWallet(id);
    const wallet = wallets.find((w) => w.id === id);
    if (wallet && !wallet.unlocked) {
      setOpen(false);
      setDialog({ kind: 'unlock', wallet });
    }
  };

  const toggle = (next: boolean) => {
    if (!next) {
      setActiveConsoleWallet(null);
      return;
    }
    const first = active ?? wallets[0];
    if (!first) {
      setOpen(false);
      setDialog({ kind: 'create' });
      return;
    }
    choose(first.id);
  };

  const label = !on ? null : (active?.label ?? 'Console wallet');
  const locked = on && !!active && !active.unlocked;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={locked ? `${active!.label} is locked. Click to unlock.` : 'Console wallets'}
            aria-label="Console wallets"
            className={cn(HEADER_CHIP, !on && 'w-8 justify-center px-0 text-zinc-500 dark:text-zinc-400')}
          >
            {locked ? <Lock className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}
            {label && <span className="hidden max-w-28 truncate lg:inline">{label}</span>}
            {on && active && (
              <span
                aria-label={locked ? 'locked' : 'unlocked'}
                className={cn('h-1.5 w-1.5 rounded-full', locked ? 'bg-red-500' : 'bg-emerald-500')}
              />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="flex items-start justify-between gap-3 border-b p-4">
            <div>
              <p className="text-sm font-medium">Sign with a Console wallet</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Every console tool, faucet drop and P-Chain step uses this wallet, with no popup per transaction.
              </p>
            </div>
            <Switch checked={on} onCheckedChange={toggle} aria-label="Sign with a Console wallet" />
          </div>

          {on && (
            <div className="flex flex-col gap-1 p-2">
              {!ready ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">Loading…</p>
              ) : wallets.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">No Console wallets in this browser yet.</p>
              ) : (
                wallets.map((w) => (
                  <div
                    key={w.id}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5',
                      w.id === activeId ? 'bg-accent' : 'hover:bg-accent/50',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => choose(w.id)}
                      className="flex min-w-0 flex-1 flex-col text-left"
                    >
                      <span className="truncate text-sm">{w.label}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {short(w.address)}
                        {!w.backedUp && <span className="ml-2 text-amber-600 dark:text-amber-400">not backed up</span>}
                      </span>
                    </button>
                    {w.unlocked ? (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => lock(w.id)}>
                        Lock
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          setActiveConsoleWallet(w.id);
                          setOpen(false);
                          setDialog({ kind: 'unlock', wallet: w });
                        }}
                      >
                        Unlock
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {error && <p className="px-4 pb-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex flex-wrap gap-1 border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setOpen(false);
                setDialog({ kind: 'create' });
              }}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Create
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setOpen(false);
                setDialog({ kind: 'import' });
              }}
            >
              <Upload className="mr-1 h-3.5 w-3.5" /> Import
            </Button>
            {wallets.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setOpen(false);
                  setManage(true);
                }}
              >
                <Settings2 className="mr-1 h-3.5 w-3.5" /> Manage
              </Button>
            )}
          </div>
          <p className="flex items-center gap-1.5 border-t px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
            <KeyRound className="h-3 w-3 shrink-0" /> {BROWSER_ONLY_SHORT}
          </p>
        </PopoverContent>
      </Popover>

      <WalletDialogs open={dialog} setOpen={changeDialog} onCreated={(w) => setActiveConsoleWallet(w.id)} />
      {manage && <ConsoleWalletsDialog onClose={() => setManage(false)} />}
    </>
  );
}
