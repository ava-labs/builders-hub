'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Check, Copy, Loader2, RotateCcw } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useSelectedL1 } from '@/components/toolbox/stores/l1ListStore';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { Note } from '@/components/toolbox/components/Note';
import { cn } from '@/lib/utils';
import { InspectorShell } from './InspectorShell';
import { useDeploySourceToken } from '../hooks/useDeploySourceToken';
import { useDeployWrappedNative } from '../hooks/useDeployWrappedNative';
import { useWrappedNativeToken } from '@/components/toolbox/hooks/useWrappedNativeToken';
import { truncateAddress } from '../utils/explorer-url';
import type { Address, Bridge, BridgePhase } from '../types';

type Mode = 'existing' | 'deploy-test' | 'wrap-native';

interface TokenInspectorProps {
  onPhaseChange: (next: BridgePhase) => void;
  /** Address selected so far (from prior deploy, paste, or migration). */
  underlyingTokenAddress: Address | null;
  /** Lift the chosen address to the parent so Phase 2 can read it. */
  onTokenSelected: (address: Address | null) => void;
  /** Active bridge, if any — used to detect "editing an existing bridge". */
  bridge: Bridge | null;
  /** Reset the active bridge association so Phase 1 starts fresh. */
  onStartNewBridge: () => void;
  /** True when the user has explicitly chosen to start fresh. Suppresses the
   *  "editing existing bridge" banner even if `bridge` momentarily appears
   *  non-null during a re-render. */
  newBridgeIntent: boolean;
}

export function TokenInspector({
  onPhaseChange,
  underlyingTokenAddress,
  onTokenSelected,
  bridge,
  onStartNewBridge,
  newBridgeIntent,
}: TokenInspectorProps) {
  const selectedL1 = useSelectedL1();
  const [mode, setMode] = useState<Mode>('deploy-test');

  // When a bridge already exists, deploying a new token here would replace the
  // underlying token used by downstream phases (via pending-overrides-bridge in
  // useBridgeContext). Make that consequence explicit and offer a one-click reset.
  //
  // `newBridgeIntent` short-circuits the banner: if the user just clicked "+ New
  // bridge", we mustn't taunt them with a "you're editing an existing bridge"
  // message. The store guarantees `bridge === null` while intent is true, but
  // we check intent explicitly so a future store change can't quietly regress.
  const showExistingBridgeBanner = !newBridgeIntent && Boolean(bridge?.underlyingTokenAddress);

  return (
    <InspectorShell
      banner={
        showExistingBridgeBanner ? (
          <Note variant="warning">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <span>
                You&apos;re looking at an existing bridge (TokenHome already deployed). Deploying or selecting a new
                token here will <strong>replace</strong> it for the next phases. Start a fresh bridge to keep the
                current one intact.
              </span>
              <button
                type="button"
                onClick={onStartNewBridge}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800/60"
              >
                <RotateCcw className="h-3 w-3" aria-hidden />
                Start new bridge
              </button>
            </div>
          </Note>
        ) : null
      }
      footer={
        <button
          type="button"
          onClick={() => onPhaseChange('home')}
          disabled={!underlyingTokenAddress}
          className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Continue to Home
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Pick the token you want to bridge from {selectedL1?.name ?? 'the Home chain'}. Paste an address you already
          deployed or deploy a test ERC-20 to play with.
        </p>

        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(value) => {
            if (value === 'existing' || value === 'deploy-test' || value === 'wrap-native') setMode(value);
          }}
          variant="outline"
          className="w-full"
        >
          <ToggleGroupItem value="deploy-test" className="flex-1">
            Deploy test ERC-20
          </ToggleGroupItem>
          <ToggleGroupItem value="wrap-native" className="flex-1">
            Wrap native token
          </ToggleGroupItem>
          <ToggleGroupItem value="existing" className="flex-1">
            Use existing token
          </ToggleGroupItem>
        </ToggleGroup>

        {mode === 'deploy-test' && (
          <DeployTestPanel
            chainName={selectedL1?.name ?? 'Home chain'}
            existingAddress={underlyingTokenAddress}
            onTokenSelected={onTokenSelected}
          />
        )}
        {mode === 'existing' && (
          <ExistingTokenPanel
            chainName={selectedL1?.name}
            existingAddress={underlyingTokenAddress}
            onTokenSelected={onTokenSelected}
          />
        )}
        {mode === 'wrap-native' && (
          <WrapNativePanel existingAddress={underlyingTokenAddress} onTokenSelected={onTokenSelected} />
        )}
      </div>
    </InspectorShell>
  );
}

interface DeployPanelProps {
  chainName: string;
  existingAddress: Address | null;
  onTokenSelected: (a: Address | null) => void;
}

function DeployTestPanel({ chainName, existingAddress, onTokenSelected }: DeployPanelProps) {
  const { walletEVMAddress } = useWalletStore();
  const { deployExampleErc20, isDeploying, error } = useDeploySourceToken();

  const handleDeploy = async () => {
    const addr = await deployExampleErc20();
    if (addr) onTokenSelected(addr);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Deploy a test ERC-20</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          1,000,000 tokens minted to{' '}
          {walletEVMAddress ? (
            <code className="font-mono text-[11px]">{truncateAddress(walletEVMAddress)}</code>
          ) : (
            'your wallet'
          )}{' '}
          on {chainName}.
        </p>
      </div>

      <button
        type="button"
        onClick={handleDeploy}
        disabled={isDeploying}
        className={cn(
          'inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors',
          'bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50',
          'dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white',
        )}
      >
        {isDeploying ? (
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
        ) : (
          <Check aria-hidden className="h-4 w-4" />
        )}
        {isDeploying ? 'Deploying ExampleERC20…' : 'Deploy ExampleERC20'}
      </button>

      {existingAddress && <SelectedTokenChip address={existingAddress} chainName={chainName} />}
      {error && (
        <Note variant="destructive">
          <span className="text-xs">{error.message}</span>
        </Note>
      )}
    </div>
  );
}

interface ExistingPanelProps {
  chainName?: string;
  existingAddress: Address | null;
  onTokenSelected: (a: Address | null) => void;
}

function ExistingTokenPanel({ chainName, existingAddress, onTokenSelected }: ExistingPanelProps) {
  const viemChain = useViemChainStore();
  const [pasted, setPasted] = useState<string>(existingAddress ?? '');
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [meta, setMeta] = useState<{ name: string; symbol: string; decimals: number } | null>(null);

  useEffect(() => {
    if (existingAddress && !pasted) setPasted(existingAddress);
  }, [existingAddress, pasted]);

  const handleVerify = async () => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(pasted)) {
      setVerifyError('Enter a valid 0x-prefixed EVM address.');
      return;
    }
    if (!viemChain) {
      setVerifyError('Connect to the Home chain to verify the token.');
      return;
    }
    setVerifyError(null);
    setVerifying(true);
    try {
      const client = makePublicClientForChain(viemChain.rpcUrls.default.http[0], [], viemChain);
      if (!client) throw new Error('Failed to create RPC client.');
      const [name, symbol, decimals] = await Promise.all([
        client.readContract({
          address: pasted as Address,
          abi: ExampleERC20.abi,
          functionName: 'name',
        }) as Promise<string>,
        client.readContract({
          address: pasted as Address,
          abi: ExampleERC20.abi,
          functionName: 'symbol',
        }) as Promise<string>,
        client.readContract({ address: pasted as Address, abi: ExampleERC20.abi, functionName: 'decimals' }) as Promise<
          bigint | number
        >,
      ]);
      setMeta({ name, symbol, decimals: Number(decimals) });
      onTokenSelected(pasted as Address);
    } catch (err) {
      setVerifyError(`Could not read ERC-20 metadata: ${(err as Error).message}`);
      setMeta(null);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
          Token contract address {chainName ? `on ${chainName}` : ''}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            spellCheck={false}
            value={pasted}
            onChange={(e) => setPasted(e.target.value.trim())}
            placeholder="0x…"
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 font-mono text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="button"
            onClick={handleVerify}
            disabled={!pasted || verifying}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {verifying ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : null}
            Verify
          </button>
        </div>
        <p className="text-[11px] italic text-zinc-500 dark:text-zinc-400">
          Bridging a native token? Wrap it first (e.g. WAVAX) and paste the wrapped ERC-20 address here.
        </p>
      </div>

      {verifyError && (
        <Note variant="destructive">
          <span className="text-xs">{verifyError}</span>
        </Note>
      )}

      {meta && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-emerald-50/60 px-3 py-2 text-xs dark:bg-emerald-950/20">
          <span className="font-medium text-emerald-800 dark:text-emerald-300">{meta.name}</span>
          <span className="rounded-full bg-white/50 px-2 py-0.5 font-mono text-[10px] text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
            {meta.symbol}
          </span>
          <span className="rounded-full bg-white/50 px-2 py-0.5 font-mono text-[10px] text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
            {meta.decimals} decimals
          </span>
        </div>
      )}

      {existingAddress && !meta && <SelectedTokenChip address={existingAddress} chainName={chainName} />}
    </div>
  );
}

interface WrapNativePanelProps {
  existingAddress: Address | null;
  onTokenSelected: (a: Address | null) => void;
}

function WrapNativePanel({ existingAddress, onTokenSelected }: WrapNativePanelProps) {
  const selectedL1 = useSelectedL1();
  const { walletEVMAddress } = useWalletStore();
  const { deployWrappedNative, isDeploying, error } = useDeployWrappedNative();
  const wrappedAddress = (selectedL1?.wrappedTokenAddress ?? '') as Address | '';
  const hasExistingWrapped = Boolean(wrappedAddress && /^0x[a-fA-F0-9]{40}$/.test(wrappedAddress));
  const coinName = selectedL1?.coinName ?? 'native';
  const isAlreadyActive =
    hasExistingWrapped && (existingAddress ?? '').toLowerCase() === (wrappedAddress as string).toLowerCase();

  // Single balance source-of-truth for the wrap panel: read native ALWAYS
  // (regardless of Wtest deploy state) so users see their funds before
  // deciding to wrap. Wrapped balance only reads when the contract exists.
  // `refreshTick` is bumped after every successful wrap/unwrap by the
  // child controls so balances re-fetch without a full unmount/remount.
  const [nativeBalance, setNativeBalance] = useState<bigint | null>(null);
  const [wrappedBalance, setWrappedBalance] = useState<bigint | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    if (!selectedL1?.rpcUrl || !walletEVMAddress) return;
    let cancelled = false;
    const client = makePublicClientForChain(selectedL1.rpcUrl);
    if (!client) return;

    void client
      .getBalance({ address: walletEVMAddress as `0x${string}` })
      .then((nat) => {
        if (!cancelled) setNativeBalance(nat as bigint);
      })
      .catch(() => {
        if (!cancelled) setNativeBalance(null);
      });

    if (hasExistingWrapped) {
      void (
        client.readContract({
          address: wrappedAddress as Address,
          abi: [
            {
              inputs: [{ name: 'account', type: 'address' }],
              name: 'balanceOf',
              outputs: [{ name: '', type: 'uint256' }],
              stateMutability: 'view',
              type: 'function',
            },
          ],
          functionName: 'balanceOf',
          args: [walletEVMAddress],
        }) as Promise<bigint>
      )
        .then((wrap) => {
          if (!cancelled) setWrappedBalance(wrap as bigint);
        })
        .catch(() => {
          if (!cancelled) setWrappedBalance(null);
        });
    } else {
      setWrappedBalance(null);
    }

    return () => {
      cancelled = true;
    };
  }, [selectedL1?.rpcUrl, walletEVMAddress, wrappedAddress, hasExistingWrapped, refreshTick]);

  const handleUseExisting = () => {
    if (hasExistingWrapped) onTokenSelected(wrappedAddress as Address);
  };

  const handleDeploy = async () => {
    const addr = await deployWrappedNative();
    if (addr) onTokenSelected(addr);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Balance summary always visible — even when no Wtest is deployed yet
          users can see how much native they hold to decide whether to wrap. */}
      <BalanceSummary
        coinName={coinName}
        native={nativeBalance}
        wrapped={hasExistingWrapped ? wrappedBalance : null}
        showWrapped={hasExistingWrapped}
      />
      {hasExistingWrapped ? (
        <>
          <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Wrapped {coinName} already deployed on {selectedL1?.name}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Re-use this contract instead of deploying a new one. Deposit native to mint W{coinName}; withdraw to burn.
            </p>
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-1.5 text-xs dark:bg-zinc-900">
              <span className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                {truncateAddress(wrappedAddress as Address, 10, 6)}
              </span>
              <CopyTinyButton value={wrappedAddress as string} />
            </div>
          </div>
          <WrapUnwrapControls
            wrappedAddress={wrappedAddress as Address}
            coinName={coinName}
            nativeBalance={nativeBalance}
            wrappedBalance={wrappedBalance}
            onRefresh={() => setRefreshTick((t) => t + 1)}
          />
          {isAlreadyActive ? (
            <div
              className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium cursor-default',
                'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
              )}
              aria-disabled
            >
              <Check aria-hidden className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Selected as source token
            </div>
          ) : (
            <button
              type="button"
              onClick={handleUseExisting}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                'bg-zinc-900 text-white hover:bg-zinc-700',
                'dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white',
              )}
            >
              <Check aria-hidden className="h-4 w-4" />
              Use this wrapped token as the source
            </button>
          )}
        </>
      ) : (
        <>
          <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Deploy WrappedNativeToken on {selectedL1?.name ?? 'the Home chain'}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Mints W{coinName} when you deposit native gas. The wrapped contract is the source ERC-20 for bridging your
              chain&apos;s native asset.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDeploy}
            disabled={isDeploying}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              'bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50',
              'dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white',
            )}
          >
            {isDeploying ? (
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            ) : (
              <Check aria-hidden className="h-4 w-4" />
            )}
            {isDeploying ? 'Deploying WrappedNativeToken…' : 'Deploy WrappedNativeToken'}
          </button>
        </>
      )}

      {existingAddress && <SelectedTokenChip address={existingAddress} chainName={selectedL1?.name} />}
      {error && (
        <Note variant="destructive">
          <span className="text-xs">{error.message}</span>
        </Note>
      )}
    </div>
  );
}

interface WrapUnwrapControlsProps {
  wrappedAddress: Address;
  coinName: string;
  nativeBalance: bigint | null;
  wrappedBalance: bigint | null;
  onRefresh: () => void;
}

function WrapUnwrapControls({
  wrappedAddress: _wrappedAddress,
  coinName,
  nativeBalance,
  wrappedBalance,
  onRefresh,
}: WrapUnwrapControlsProps) {
  const selectedL1 = useSelectedL1();
  const wrapped = useWrappedNativeToken();
  const [wrapAmount, setWrapAmount] = useState('');
  const [unwrapAmount, setUnwrapAmount] = useState('');
  const [busy, setBusy] = useState<'wrap' | 'unwrap' | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handleWrap = async () => {
    if (!wrapAmount || !/^\d+(\.\d+)?$/.test(wrapAmount)) return;
    setBusy('wrap');
    setErr(null);
    try {
      const hash = await wrapped.deposit(wrapAmount);
      // deposit() resolves on broadcast — wait for the receipt before refreshing
      // balances so the readContract call sees the mined state.
      if (selectedL1?.rpcUrl && hash) {
        try {
          const client = makePublicClientForChain(selectedL1.rpcUrl);
          if (client) await client.waitForTransactionReceipt({ hash: hash as Address, timeout: 60_000 });
        } catch {
          // Best-effort: if the receipt wait fails the refresh below still fires.
        }
      }
      setWrapAmount('');
      onRefresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const handleUnwrap = async () => {
    if (!unwrapAmount || !/^\d+(\.\d+)?$/.test(unwrapAmount)) return;
    setBusy('unwrap');
    setErr(null);
    try {
      const hash = await wrapped.withdraw(unwrapAmount);
      if (selectedL1?.rpcUrl && hash) {
        try {
          const client = makePublicClientForChain(selectedL1.rpcUrl);
          if (client) await client.waitForTransactionReceipt({ hash: hash as Address, timeout: 60_000 });
        } catch {
          // Best-effort.
        }
      }
      setUnwrapAmount('');
      onRefresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-200/80 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <WrapField
          label={`Wrap (deposit ${coinName})`}
          amount={wrapAmount}
          onChange={setWrapAmount}
          onMax={() => nativeBalance !== null && setWrapAmount(formatBalance(nativeBalance, 18))}
          onSubmit={handleWrap}
          isBusy={busy === 'wrap'}
          submitLabel={`Wrap → W${coinName}`}
        />
        <WrapField
          label={`Unwrap (withdraw W${coinName})`}
          amount={unwrapAmount}
          onChange={setUnwrapAmount}
          onMax={() => wrappedBalance !== null && setUnwrapAmount(formatBalance(wrappedBalance, 18))}
          onSubmit={handleUnwrap}
          isBusy={busy === 'unwrap'}
          submitLabel={`Unwrap → ${coinName}`}
        />
      </div>
      {err && (
        <Note variant="destructive">
          <span className="text-xs">{err}</span>
        </Note>
      )}
    </div>
  );
}

/**
 * Renders the native (and optionally wrapped) balance row at the top of
 * the Wrap-native panel. Always shown for connected wallets so the user
 * can size their wrap intent against actual holdings — even before any
 * Wtest contract is deployed.
 */
function BalanceSummary({
  coinName,
  native,
  wrapped,
  showWrapped,
}: {
  coinName: string;
  native: bigint | null;
  wrapped: bigint | null;
  showWrapped: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200/80 bg-zinc-50/40 px-4 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-300">
      <span className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          Native
        </span>
        <span className="font-mono">
          {formatBalance(native, 18)} {coinName}
        </span>
      </span>
      {showWrapped && (
        <span className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            Wrapped
          </span>
          <span className="font-mono">
            {formatBalance(wrapped, 18)} W{coinName}
          </span>
        </span>
      )}
    </div>
  );
}

interface WrapFieldProps {
  label: string;
  amount: string;
  onChange: (value: string) => void;
  onMax: () => void;
  onSubmit: () => void;
  isBusy: boolean;
  submitLabel: string;
}

function WrapField({ label, amount, onChange, onMax, onSubmit, isBusy, submitLabel }: WrapFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.0"
          className="w-full rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <button
          type="button"
          onClick={onMax}
          className="rounded-md border border-zinc-200 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
        >
          Max
        </button>
      </div>
      <button
        type="button"
        onClick={onSubmit}
        disabled={isBusy || !amount}
        className="inline-flex items-center justify-center gap-1.5 rounded-md bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        {isBusy ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : null}
        {submitLabel}
      </button>
    </div>
  );
}

function formatBalance(value: bigint | null, decimals: number): string {
  if (value === null) return '—';
  const factor = 10n ** BigInt(decimals);
  const whole = value / factor;
  const fraction = value % factor;
  if (fraction === 0n) return whole.toString();
  const padded = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole.toString()}.${padded.slice(0, 4)}`;
}

function SelectedTokenChip({ address, chainName }: { address: Address; chainName?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50/60 px-3 py-2 text-xs dark:bg-emerald-950/20">
      <div className="flex flex-col">
        <span className="font-medium text-emerald-800 dark:text-emerald-300">Token selected</span>
        <span className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">on {chainName ?? 'Home chain'}</span>
      </div>
      <code className="flex items-center gap-1 font-mono text-[11px] text-emerald-800 dark:text-emerald-300">
        {truncateAddress(address)}
        <CopyTinyButton value={address} />
      </code>
    </div>
  );
}

function CopyTinyButton({ value }: { value: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== 'undefined') {
          void window.navigator.clipboard.writeText(value);
        }
      }}
      className="rounded p-0.5 text-emerald-700/70 transition-colors hover:bg-emerald-200/40 dark:text-emerald-400/80"
      aria-label="Copy address"
    >
      <Copy className="h-3 w-3" />
    </button>
  );
}
