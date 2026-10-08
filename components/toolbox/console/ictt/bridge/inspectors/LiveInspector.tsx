'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus, Wallet } from 'lucide-react';
import { Alert } from '@/components/toolbox/components/Alert';
import { Button } from '@/components/toolbox/components/Button';
import { ConnectedWalletIcon } from '@/components/toolbox/components/ConnectedWalletIcon';
import { HashChip, SpecPlate, SpecRow } from '@/components/explorer-v2/ui';
import { useL1ByChainId, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import { useWallet } from '@/components/toolbox/hooks/useWallet';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { toast } from '@/lib/toast';
import { ContractDeployViewer } from '@/components/console/contract-deploy-viewer';
import { ICTT_HOME_SEND_SOURCES } from '@/lib/ictt/contractSources';
import { useSendTokens } from '../hooks/useSendTokens';
import { useBridgeContext } from '../hooks/useBridgeContext';
import { buildTxUrl, truncateAddress } from '../utils/explorer-url';
import { importRemoteToCoreWallet } from '../utils/importToCoreWallet';
import { BRIDGE_BASE_PATH } from '../bridge-steps';
import {
  ChainMark,
  Dot,
  EYEBROW,
  FIELD_ADDON,
  FRAME,
  Inspector,
  MONO_FIELD,
  MONO_MUTED,
  StatusTag,
  TextAction,
} from '../ui';
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
  const walletClient = useResolvedWalletClient();
  const setPendingDestinationL1Id = useIcttBridgeStore((s) => s.setPendingDestinationL1Id);
  const activityLog = useIcttBridgeStore((s) => s.activityLog);

  const { send, resetError, stage, isBusy, error } = useSendTokens({ bridge, remote: selectedRemote });
  const [amount, setAmount] = useState<string>('');
  const [recipient, setRecipient] = useState<string>(walletEVMAddress);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [lastTx, setLastTx] = useState<Address | null>(null);
  const [importState, setImportState] = useState<'idle' | 'switching' | 'prompting' | 'added'>('idle');

  // Mirror the activity-log entry for the most recent send so the UI can
  // react when `useDeliveryWatcher` flips it to `delivered`. Matching by
  // `txHash` is reliable here: `useSendTokens` writes the hash onto the
  // pending row before resolving, so the lookup is non-null by the time the
  // user can see anything below.
  const lastSendActivity = useMemo(() => {
    if (!lastTx) return undefined;
    return activityLog.find((e) => e.kind === 'send' && e.txHash === lastTx);
  }, [activityLog, lastTx]);
  const isDelivered = lastSendActivity?.status === 'delivered';

  // Reset the "added" pill when the user starts a fresh send so the CTA
  // re-appears for the next delivery.
  useEffect(() => {
    setImportState('idle');
  }, [lastTx]);

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
  // Keeps the error Alert in sync with the inputs the user can see.
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

  // Prompt the connected wallet (Core, a Console wallet, or any EIP-1193 wallet with `wallet_watchAsset`)
  // to add the wrapped remote token. The wallet must be on the destination chain
  // for the token to land on the right network, so switch first when needed.
  const handleImportToWallet = async () => {
    if (!remoteL1 || !selectedRemote?.address || !bridge?.symbol || bridge.decimals === undefined) return;
    if (!walletClient) {
      toast.error('Wallet not connected', 'Connect a wallet that supports custom tokens.');
      return;
    }
    try {
      if (walletChainId !== remoteL1.evmChainId) {
        setImportState('switching');
        const switched = await switchChainOrAdd(remoteL1);
        if (!switched) {
          setImportState('idle');
          return;
        }
      }
      setImportState('prompting');
      const added = await importRemoteToCoreWallet(walletClient, {
        address: selectedRemote.address,
        symbol: bridge.symbol,
        decimals: bridge.decimals,
      });
      if (added) {
        setImportState('added');
        toast.success(
          `${bridge.symbol} added to your wallet`,
          `${remoteL1.name} · ${truncateAddress(selectedRemote.address)}`,
        );
      } else {
        setImportState('idle');
      }
    } catch (err) {
      setImportState('idle');
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Could not add token', message);
    }
  };

  const isNativeHome = bridge?.kind === 'native-home';
  const sendFailed = lastSendActivity?.status === 'failed';
  const track: { title: string; status: TrackStatus; label: string }[] = [
    {
      title: `Send on ${homeL1?.name ?? 'Home'}`,
      status: lastTx ? 'done' : error ? 'error' : isBusy ? 'current' : 'upcoming',
      label: lastTx ? 'Done' : error ? 'Error' : isBusy ? stageLabel(stage, isNativeHome) : 'Ready',
    },
    {
      title: 'ICM relay',
      status: isDelivered ? 'done' : sendFailed ? 'error' : lastTx ? 'current' : 'upcoming',
      label: isDelivered ? 'Done' : sendFailed ? 'Failed' : lastTx ? 'Relaying' : 'Up next',
    },
    {
      title: `Arrive on ${remoteL1?.name ?? 'Remote'}`,
      status: isDelivered ? 'done' : 'upcoming',
      label: isDelivered ? 'Delivered' : 'Up next',
    },
  ];

  return (
    <ContractDeployViewer contracts={ICTT_HOME_SEND_SOURCES}>
      <Inspector
        label="Phase 6 · Live send"
        meta={readiness.ok ? <StatusTag tone="ok">Bridge ready</StatusTag> : undefined}
        banner={
          !hasRemotes ? (
            <Alert variant="warning">
              <div className="flex flex-col items-start gap-2">
                <span>Deploy a Remote in Phase 3 before sending tokens.</span>
                <TextAction icon={Plus} onClick={handleAddAnotherDestination}>
                  Deploy first Remote
                </TextAction>
              </div>
            </Alert>
          ) : null
        }
      >
        <div className="flex flex-col gap-5">
          {!readiness.ok && (
            <LiveReadinessCard
              checks={readiness.checks}
              allOk={readiness.ok}
              onSwitchToHome={handleSwitchToHome}
              onNavigate={(href) => router.push(href)}
            />
          )}

          <div>
            {/* From and To share one hairline, joined by the mono arrow. */}
            <div className="grid grid-cols-1 gap-px border border-zinc-200 bg-zinc-200 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] dark:border-zinc-800 dark:bg-zinc-800">
              <SendEnd
                side="From"
                l1={homeL1 ?? null}
                name={homeL1?.name ?? 'Home'}
                figure={balance !== null ? formatAmount(balance, decimals) : '—'}
                unit={bridge?.symbol ?? ''}
                caption="Your balance"
              />
              <div
                aria-hidden
                className="flex items-center justify-center bg-white px-4 py-1.5 font-mono text-[13px] text-zinc-400 md:py-0 dark:bg-zinc-950 dark:text-zinc-500"
              >
                <span className="md:hidden">↓</span>
                <span className="hidden md:inline">→</span>
              </div>
              <SendEnd
                side="To"
                l1={remoteL1 ?? null}
                name={remoteL1?.name ?? 'Remote'}
                figure={selectedRemote?.address ? truncateAddress(selectedRemote.address) : '—'}
                caption={selectedRemote?.kind === 'native-remote' ? 'NativeTokenRemote' : 'TokenRemote'}
                mono
                action={
                  hasRemotes ? (
                    <TextAction icon={Plus} tone="muted" onClick={handleAddAnotherDestination}>
                      Add destination
                    </TextAction>
                  ) : undefined
                }
              />
            </div>

            {/* Amount */}
            <div className="flex flex-col gap-2 border-x border-b border-zinc-200 bg-white px-5 py-5 dark:border-zinc-800 dark:bg-zinc-950">
              <label htmlFor="ictt-send-amount" className={EYEBROW}>
                Amount
              </label>
              <div className="flex">
                <div className="relative min-w-0 flex-1">
                  <input
                    id="ictt-send-amount"
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.0"
                    aria-invalid={amountExceedsBalance}
                    className={`${MONO_FIELD} h-12 pr-20 text-lg ${amountExceedsBalance ? 'border-red-400 focus:border-red-600 dark:border-red-800' : ''}`}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                    {bridge?.symbol ?? ''}
                  </span>
                </div>
                {balance !== null && (
                  <button
                    type="button"
                    onClick={() => setAmount(formatAmount(balance, decimals))}
                    className={`${FIELD_ADDON} h-12 px-4`}
                  >
                    Max
                  </button>
                )}
              </div>
              {amountExceedsBalance && balance !== null ? (
                <p className="font-mono text-[11px] tabular-nums text-red-600 dark:text-red-400">
                  More than your balance of {formatAmount(balance, decimals)} {bridge?.symbol ?? ''}
                </p>
              ) : balance !== null ? (
                <p className={MONO_MUTED}>
                  Available {formatAmount(balance, decimals)} {bridge?.symbol ?? ''} on {homeL1?.name ?? 'Home'}
                </p>
              ) : null}
            </div>

            {/* Recipient */}
            <div className="flex flex-col gap-2 border-x border-b border-zinc-200 bg-white px-5 py-5 dark:border-zinc-800 dark:bg-zinc-950">
              <label htmlFor="ictt-send-recipient" className={EYEBROW}>
                Recipient on {remoteL1?.name ?? 'Remote'}
              </label>
              <div className="flex">
                <input
                  id="ictt-send-recipient"
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value.trim())}
                  placeholder="0x…"
                  aria-invalid={!validRecipient && Boolean(recipient)}
                  className={`${MONO_FIELD} ${!validRecipient && recipient ? 'border-red-400 focus:border-red-600 dark:border-red-800' : ''}`}
                />
                {walletEVMAddress && (
                  <button type="button" onClick={() => setRecipient(walletEVMAddress)} className={FIELD_ADDON}>
                    Self
                  </button>
                )}
              </div>
              {!validRecipient && recipient && (
                <p className="text-[12px] text-red-600 dark:text-red-400">Not a valid EVM address.</p>
              )}
            </div>

            {/* Progress and action */}
            <div className="flex flex-col gap-5 border-x border-b border-zinc-200 bg-white px-5 py-5 dark:border-zinc-800 dark:bg-zinc-950">
              <SendTrack steps={track} />

              {lastTx && (
                <SpecPlate className="border-y border-zinc-200 dark:border-zinc-800">
                  <SpecRow label="Send tx">
                    <span className="flex flex-wrap items-center gap-3">
                      <HashChip value={lastTx} len={14} />
                      {sendTxUrl && (
                        <TextAction href={sendTxUrl} tone="muted">
                          Explorer
                        </TextAction>
                      )}
                    </span>
                  </SpecRow>
                  {lastSendActivity?.icmMessageId && (
                    <SpecRow label="ICM message">
                      <HashChip value={lastSendActivity.icmMessageId} len={14} />
                    </SpecRow>
                  )}
                </SpecPlate>
              )}

              {error && <Alert variant="error">{error.message}</Alert>}

              {isDelivered && selectedRemote?.address && bridge?.symbol && bridge.decimals !== undefined && (
                <PostDeliveryImportCard
                  tokenSymbol={bridge.symbol}
                  remoteAddress={selectedRemote.address}
                  remoteChainName={remoteL1?.name ?? 'Remote'}
                  importState={importState}
                  onImport={handleImportToWallet}
                />
              )}

              <Button
                onClick={handleSend}
                disabled={!readiness.ok || !parsed || parsed <= 0n || !validRecipient || amountExceedsBalance}
                loading={isBusy}
                loadingText={stageLabel(stage, isNativeHome)}
                variant={stage === 'submitted' ? 'outline' : 'primary'}
                icon={<ConnectedWalletIcon className="h-3.5 w-3.5 shrink-0" />}
              >
                {stage === 'submitted' || !parsed
                  ? stageLabel(stage, isNativeHome)
                  : `Send ${amount} ${bridge?.symbol ?? ''} to ${remoteL1?.name ?? 'Remote'}`}
              </Button>
            </div>
          </div>
        </div>
      </Inspector>
    </ContractDeployViewer>
  );
}

type TrackStatus = 'done' | 'current' | 'error' | 'upcoming';

/** Send, relay, arrive as a segmented track: done in ink, current in red, upcoming in grey. */
function SendTrack({ steps }: { steps: { title: string; status: TrackStatus; label: string }[] }) {
  return (
    <ol aria-label="Transfer progress" className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-1">
      {steps.map((step, i) => {
        const done = step.status === 'done';
        const current = step.status === 'current' || step.status === 'error';
        return (
          <li key={step.title} aria-current={current ? 'step' : undefined} className="flex min-w-0 flex-col gap-2">
            <span
              aria-hidden
              className={`block h-1 transition-colors ${
                done ? 'bg-zinc-900 dark:bg-zinc-100' : current ? 'bg-[#E6212F]' : 'bg-zinc-200 dark:bg-zinc-800'
              }`}
            />
            <span className="flex min-w-0 items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-baseline gap-1.5">
                <span
                  className={`font-mono text-[10px] font-bold tabular-nums ${
                    done
                      ? 'text-zinc-900 dark:text-zinc-100'
                      : current
                        ? 'text-[#E6212F]'
                        : 'text-zinc-400 dark:text-zinc-600'
                  }`}
                >
                  {done ? (
                    <Check className="inline h-3 w-3 -translate-y-px" aria-label="Completed" />
                  ) : (
                    String(i + 1).padStart(2, '0')
                  )}
                </span>
                <span
                  className={`truncate text-[12.5px] ${
                    current || done ? 'font-medium text-zinc-900 dark:text-zinc-50' : 'text-zinc-400 dark:text-zinc-500'
                  }`}
                >
                  {step.title}
                </span>
              </span>
              <span
                className={`flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] ${
                  step.status === 'error' ? 'text-red-600 dark:text-red-400' : 'text-zinc-400 dark:text-zinc-500'
                }`}
              >
                {step.status === 'current' && <Dot tone="pending" pulse />}
                {step.label}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function SendEnd({
  side,
  l1,
  name,
  figure,
  unit,
  caption,
  mono,
  action,
}: {
  side: string;
  l1: L1ListItem | null;
  name: string;
  figure: string;
  unit?: string;
  caption: string;
  mono?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4 bg-white px-5 py-5 dark:bg-zinc-950">
      <div className="flex items-start gap-3">
        <ChainMark l1={l1} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={EYEBROW}>{side}</span>
          <h3 className="truncate text-[15px] font-semibold text-zinc-900 dark:text-zinc-50">{name}</h3>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className={EYEBROW}>{caption}</span>
        <span
          className={
            mono
              ? 'truncate font-mono text-[15px] tabular-nums text-zinc-900 dark:text-zinc-50'
              : 'truncate font-mono text-xl tabular-nums tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50'
          }
        >
          {figure}
          {unit && <span className="ml-1.5 text-sm font-normal text-zinc-400 dark:text-zinc-500">{unit}</span>}
        </span>
        {action && <span className="mt-1">{action}</span>}
      </div>
    </div>
  );
}

interface PostDeliveryImportCardProps {
  tokenSymbol: string;
  remoteAddress: Address;
  remoteChainName: string;
  importState: 'idle' | 'switching' | 'prompting' | 'added';
  onImport: () => void;
}

/**
 * Shown after `useDeliveryWatcher` flips the send activity to `delivered`.
 * Surfaces the wrapped token address (the bit users previously had to dig out
 * of explorer logs) and a one-click add to the connected wallet via `wallet_watchAsset`.
 */
function PostDeliveryImportCard({
  tokenSymbol,
  remoteAddress,
  remoteChainName,
  importState,
  onImport,
}: PostDeliveryImportCardProps) {
  const isBusy = importState === 'switching' || importState === 'prompting';
  const isAdded = importState === 'added';
  return (
    <div className="flex flex-col gap-3 border border-emerald-300 px-4 py-4 dark:border-emerald-900">
      <StatusTag tone="ok">
        {tokenSymbol} delivered on {remoteChainName}
      </StatusTag>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <HashChip value={remoteAddress} len={16} />
        <Button
          onClick={onImport}
          disabled={isAdded}
          loading={isBusy}
          loadingText={importState === 'switching' ? `Switching to ${remoteChainName}…` : 'Open your wallet…'}
          variant="outline"
          size="sm"
          stickLeft
          icon={
            isAdded ? (
              <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" aria-hidden />
            ) : (
              <Wallet className="h-3 w-3" aria-hidden />
            )
          }
          className="ml-0"
        >
          {isAdded ? 'Added' : `Add ${tokenSymbol} to your wallet`}
        </Button>
      </div>
    </div>
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
  if (allOk) return null;
  const done = checks.filter((c) => c.ok).length;
  return (
    <section className={FRAME}>
      <header className="flex min-h-9 items-center justify-between gap-4 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <span className={EYEBROW}>Preflight</span>
        <span className={MONO_MUTED}>
          {done}/{checks.length} ready
        </span>
      </header>
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
        {checks.map((check) => (
          <li key={check.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5">
            <span className="flex min-w-0 items-center gap-2.5">
              <Dot tone={check.ok ? 'ok' : 'idle'} />
              <span
                className={`text-[13px] ${check.ok ? 'text-zinc-400 line-through decoration-zinc-300 dark:text-zinc-500 dark:decoration-zinc-700' : 'text-zinc-900 dark:text-zinc-50'}`}
              >
                {check.label}
              </span>
            </span>
            {!check.ok && (
              <TextAction
                onClick={() =>
                  check.switchTo ? onSwitchToHome() : check.actionHref ? onNavigate(check.actionHref) : undefined
                }
              >
                {check.actionLabel}
              </TextAction>
            )}
          </li>
        ))}
      </ul>
    </section>
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
