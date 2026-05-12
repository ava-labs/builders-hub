'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Loader2, Plus, Send } from 'lucide-react';
import { Note } from '@/components/toolbox/components/Note';
import { useL1ByChainId } from '@/components/toolbox/stores/l1ListStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import { useWallet } from '@/components/toolbox/hooks/useWallet';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { cn } from '@/lib/utils';
import { InspectorShell } from './InspectorShell';
import { useSendTokens } from '../hooks/useSendTokens';
import { useBridgeContext } from '../hooks/useBridgeContext';
import { buildTxUrl, truncateAddress } from '../utils/explorer-url';
import { BRIDGE_BASE_PATH } from '../bridge-steps';
import type { Address, Bridge, Remote } from '../types';

interface LiveInspectorProps {
  bridge: Bridge | null;
  remote: Remote | null;
}

export function LiveInspector({ bridge }: LiveInspectorProps) {
  const router = useRouter();
  const ctx = useBridgeContext({ step: 'live' });
  const remotes = ctx.remotes;
  const selectedRemote = ctx.remote;
  const selectedRemoteId = ctx.selectedRemoteId;

  const homeL1 = useL1ByChainId(bridge?.homeL1Id ?? '');
  const remoteL1 = useL1ByChainId(selectedRemote?.l1Id ?? '');
  const { walletEVMAddress } = useWalletStore();
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const { switchChainOrAdd } = useWallet();
  const setPendingDestinationL1Id = useIcttBridgeStore((s) => s.setPendingDestinationL1Id);

  const { send, resetError, stage, isBusy, error } = useSendTokens({ bridge, remote: selectedRemote });
  const [amount, setAmount] = useState<string>('');
  const [recipient, setRecipient] = useState<string>(walletEVMAddress);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [lastTx, setLastTx] = useState<Address | null>(null);

  useEffect(() => {
    if (!recipient && walletEVMAddress) setRecipient(walletEVMAddress);
  }, [walletEVMAddress, recipient]);

  // Balance read from the Home L1's RPC — independent of the wallet chain.
  // The stage dep refreshes after a successful send so the displayed balance
  // matches the wallet's post-send state.
  useEffect(() => {
    if (!bridge?.underlyingTokenAddress || !homeL1?.rpcUrl || !walletEVMAddress) return;
    let cancelled = false;
    const client = makePublicClientForChain(homeL1.rpcUrl);
    if (!client) return;
    client
      .readContract({
        address: bridge.underlyingTokenAddress,
        abi: ExampleERC20.abi,
        functionName: 'balanceOf',
        args: [walletEVMAddress],
      })
      .then((b) => {
        if (!cancelled) setBalance(b as bigint);
      })
      .catch(() => {
        if (!cancelled) setBalance(null);
      });
    return () => {
      cancelled = true;
    };
  }, [bridge?.underlyingTokenAddress, homeL1?.rpcUrl, walletEVMAddress, stage]);

  const decimals = bridge?.decimals ?? 18;
  const parsed = parseAmount(amount, decimals);
  const validRecipient = /^0x[a-fA-F0-9]{40}$/.test(recipient);
  const amountExceedsBalance = parsed !== null && balance !== null && parsed > balance;

  // Clear stale errors when the user edits inputs after a failed send.
  // Keeps the destructive Note in sync with the inputs the user can see.
  useEffect(() => {
    if (error) resetError();
    // Intentional: `error` and `resetError` excluded — they're internal state
    // updaters; including them would loop the effect on every error change.
  }, [amount, recipient, selectedRemoteId]);

  const handleSend = async () => {
    if (!parsed || parsed <= 0n) return;
    if (!validRecipient) return;
    if (amountExceedsBalance) return;
    const result = await send({ amount: parsed, recipient: recipient as Address });
    if (result) setLastTx(result.sendTx);
  };

  const handleAddAnotherDestination = () => {
    // Start the Phase 3 dropdown fresh — the user is here to pick a NEW L1,
    // not to re-deploy the existing remote.
    setPendingDestinationL1Id(null);
    router.push(`${BRIDGE_BASE_PATH}/remote`);
  };

  const sendTxUrl = buildTxUrl(homeL1, lastTx);
  const hasRemotes = remotes.length > 0;

  // Consolidate every Send-blocking precondition into one readiness object so the
  // button's disabled state and the user-facing card stay in sync. The previous
  // scattered `disabled={... || ... || ...}` made it impossible to tell *why*
  // the button was disabled, and a stale "warning" banner could lie to the user.
  const readiness = useMemo(() => {
    const isNativeHome = bridge?.kind === 'native-home';
    const checks = [
      {
        id: 'bridge',
        label: 'TokenHome deployed on Home',
        ok: Boolean(bridge?.homeAddress),
        actionLabel: 'Go to Phase 2 (Home)',
        actionHref: `${BRIDGE_BASE_PATH}/home`,
      },
      {
        id: 'remote',
        label: 'TokenRemote deployed on Remote',
        ok: Boolean(selectedRemote?.address),
        actionLabel: 'Go to Phase 3 (Remote)',
        actionHref: `${BRIDGE_BASE_PATH}/remote`,
      },
      {
        id: 'registered',
        label: 'Remote registered with Home',
        ok: Boolean(selectedRemote?.registeredAt),
        actionLabel: 'Go to Phase 4 (Register)',
        actionHref: `${BRIDGE_BASE_PATH}/register`,
      },
      {
        // Native-home bridges don't need explicit collateral — registration alone
        // is sufficient to send. Mark this row OK to keep the card honest.
        id: 'collateralized',
        label: isNativeHome ? 'Collateral (not required for native home)' : 'Collateral funded on Home',
        ok: isNativeHome ? Boolean(selectedRemote?.registeredAt) : Boolean(selectedRemote?.collateralizedAt),
        actionLabel: 'Go to Phase 5 (Collateral)',
        actionHref: `${BRIDGE_BASE_PATH}/collateral`,
      },
      {
        id: 'wallet-on-home',
        label: `Wallet on ${homeL1?.name ?? 'Home L1'}`,
        ok: Boolean(homeL1 && walletChainId === homeL1.evmChainId),
        actionLabel: `Switch to ${homeL1?.name ?? 'Home'}`,
        actionHref: null,
        switchTo: homeL1?.evmChainId ?? null,
      },
    ] as const;
    return {
      checks,
      ok: checks.every((c) => c.ok),
    };
  }, [
    bridge?.kind,
    bridge?.homeAddress,
    selectedRemote?.address,
    selectedRemote?.registeredAt,
    selectedRemote?.collateralizedAt,
    homeL1,
    walletChainId,
  ]);

  const handleSwitchToHome = async () => {
    if (!homeL1) return;
    // Use switch-or-add so a Home L1 that isn't in the wallet yet still works.
    await switchChainOrAdd(homeL1);
  };

  return (
    <InspectorShell
      banner={
        !hasRemotes ? (
          <Note variant="warning">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs">Deploy a Remote in Phase 3 before sending tokens.</span>
              <button
                type="button"
                onClick={handleAddAnotherDestination}
                className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Deploy first Remote
              </button>
            </div>
          </Note>
        ) : null
      }
      footer={
        <button
          type="button"
          onClick={handleSend}
          disabled={isBusy || !readiness.ok || !parsed || parsed <= 0n || !validRecipient || amountExceedsBalance}
          className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {isBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Send className="h-3.5 w-3.5" aria-hidden />
          )}
          {stageLabel(stage, bridge?.kind === 'native-home')}
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Send {bridge?.symbol ?? 'tokens'} from {homeL1?.name ?? 'Home'} → {remoteL1?.name ?? 'Remote'}. The relayer
          delivers; wrapped tokens land in the recipient&apos;s wallet on the destination.
        </p>

        <LiveReadinessCard
          checks={readiness.checks}
          allOk={readiness.ok}
          onSwitchToHome={handleSwitchToHome}
          onNavigate={(href) => router.push(href)}
        />

        <DestinationPicker
          remotes={remotes}
          selectedRemoteId={selectedRemoteId}
          homeL1Name={homeL1?.name ?? 'Home'}
          onAddAnother={handleAddAnotherDestination}
        />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
              Amount {bridge?.symbol ? `(${bridge.symbol})` : ''}
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              {balance !== null && (
                <button
                  type="button"
                  onClick={() => setAmount(formatAmount(balance, decimals))}
                  className="rounded-md border border-zinc-200 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                >
                  Max
                </button>
              )}
            </div>
            {amountExceedsBalance && balance !== null ? (
              <span className="text-[10px] text-red-600 dark:text-red-400">
                Amount exceeds your balance of {formatAmount(balance, decimals)} {bridge?.symbol ?? ''}
              </span>
            ) : balance !== null ? (
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                Balance · {formatAmount(balance, decimals)} {bridge?.symbol ?? ''}
              </span>
            ) : null}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
              Recipient on {remoteL1?.name ?? 'Remote'}
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value.trim())}
                placeholder="0x…"
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-mono text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              {walletEVMAddress && (
                <button
                  type="button"
                  onClick={() => setRecipient(walletEVMAddress)}
                  className="rounded-md border border-zinc-200 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                >
                  Self
                </button>
              )}
            </div>
            {!validRecipient && recipient && (
              <span className="text-[10px] text-red-600 dark:text-red-400">Invalid EVM address.</span>
            )}
          </label>
        </div>

        {error && (
          <Note variant="destructive">
            <span className="text-xs">{error.message}</span>
          </Note>
        )}

        {lastTx && sendTxUrl && (
          <Note variant="success">
            <span className="text-xs">
              Send tx submitted on {homeL1?.name}. <code className="font-mono">{truncateAddress(lastTx)}</code> ·{' '}
              <a href={sendTxUrl} target="_blank" rel="noreferrer" className="underline">
                explorer
              </a>
            </span>
          </Note>
        )}
      </div>
    </InspectorShell>
  );
}

interface DestinationPickerProps {
  remotes: Remote[];
  selectedRemoteId: Remote['id'] | null;
  homeL1Name: string;
  onAddAnother: () => void;
}

/**
 * Read-only destination summary. Multi-remote switching is handled by the
 * `RemoteTabs` row above the BridgeRibbon; this component only shows the
 * currently-selected route + an "Add another destination" CTA.
 */
function DestinationPicker({ remotes, selectedRemoteId, homeL1Name, onAddAnother }: DestinationPickerProps) {
  if (remotes.length === 0) return null;
  const selected = remotes.find((r) => r.id === selectedRemoteId) ?? remotes[0];
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-zinc-200/80 bg-zinc-50/60 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-600 dark:text-zinc-300">
        <span className="font-medium text-zinc-500 dark:text-zinc-400">Direction</span>
        <RemoteLabel remote={selected} homeL1Name={homeL1Name} />
      </div>
      <button
        type="button"
        onClick={onAddAnother}
        className="inline-flex items-center gap-1 self-start rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-700 transition-colors hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
      >
        <Plus className="h-3 w-3" aria-hidden />
        Add another destination
      </button>
    </div>
  );
}

function RemoteLabel({ remote, homeL1Name }: { remote: Remote; homeL1Name: string }) {
  const remoteL1 = useL1ByChainId(remote.l1Id);
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200">
      <span>{homeL1Name}</span>
      <span className="text-zinc-400">→</span>
      <span>{remoteL1?.name ?? 'Remote'}</span>
      <code className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">{truncateAddress(remote.address)}</code>
    </span>
  );
}

interface ReadinessCheck {
  id: string;
  label: string;
  ok: boolean;
  actionLabel: string;
  actionHref: string | null;
  switchTo?: number | null;
}

interface LiveReadinessCardProps {
  checks: ReadonlyArray<ReadinessCheck>;
  allOk: boolean;
  onSwitchToHome: () => void;
  onNavigate: (href: string) => void;
}

function LiveReadinessCard({ checks, allOk, onSwitchToHome, onNavigate }: LiveReadinessCardProps) {
  if (allOk) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300">
        <Check className="h-3.5 w-3.5" aria-hidden />
        <span className="font-medium">Bridge ready · all preflight checks pass.</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-zinc-200/80 bg-zinc-50/60 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
        Preflight
      </span>
      <ul className="flex flex-col">
        {checks.map((check) => (
          <li key={check.id} className="flex items-center justify-between gap-2 py-1 text-xs">
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  'flex h-4 w-4 items-center justify-center rounded-full',
                  check.ok
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
                )}
              >
                {check.ok ? (
                  <Check className="h-2.5 w-2.5" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 dark:bg-zinc-400" />
                )}
              </span>
              <span className={cn('text-zinc-700 dark:text-zinc-200', check.ok && 'text-zinc-500 dark:text-zinc-400')}>
                {check.label}
              </span>
            </span>
            {!check.ok && (
              <button
                type="button"
                onClick={() =>
                  check.switchTo ? onSwitchToHome() : check.actionHref ? onNavigate(check.actionHref) : undefined
                }
                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
              >
                {check.actionLabel}
                <ArrowRight className="h-3 w-3" aria-hidden />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function stageLabel(stage: ReturnType<typeof useSendTokens>['stage'], isNative: boolean): string {
  if (stage === 'approving') return 'Approving…';
  if (stage === 'confirming') return 'Confirming approval…';
  if (stage === 'sending') return 'Submitting…';
  if (stage === 'submitted') return 'Send another';
  return isNative ? 'Send native cross-chain' : 'Send tokens';
}

function parseAmount(input: string, decimals: number): bigint | null {
  const value = input.trim();
  if (!value) return null;
  if (!/^\d+(\.\d+)?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > decimals) return null;
  const padded = fraction.padEnd(decimals, '0');
  try {
    return BigInt(whole + padded);
  } catch {
    return null;
  }
}

function formatAmount(amount: bigint, decimals: number): string {
  const factor = 10n ** BigInt(decimals);
  const whole = amount / factor;
  const fraction = amount % factor;
  if (fraction === 0n) return whole.toString();
  const padded = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole.toString()}.${padded}`;
}
