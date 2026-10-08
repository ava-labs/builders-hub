'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Check, Coins, FlaskConical, Layers, RotateCcw } from 'lucide-react';
import { useSelectedL1 } from '@/components/toolbox/stores/l1ListStore';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { Alert } from '@/components/toolbox/components/Alert';
import { Button } from '@/components/toolbox/components/Button';
import { HashChip, SpecPlate, SpecRow } from '@/components/explorer-v2/ui';
import { ContractDeployViewer } from '@/components/console/contract-deploy-viewer';
import { ICTT_EXAMPLE_ERC20_SOURCES, ICTT_WRAPPED_NATIVE_SOURCES } from '@/lib/ictt/contractSources';
import { useDeploySourceToken } from '../hooks/useDeploySourceToken';
import { useDeployWrappedNative } from '../hooks/useDeployWrappedNative';
import { useWrappedNativeToken } from '@/components/toolbox/hooks/useWrappedNativeToken';
import {
  BODY,
  EYEBROW,
  FIELD_ADDON,
  FRAME,
  Field,
  Inspector,
  MONO,
  MONO_FIELD,
  Option,
  OptionGrid,
  StatusTag,
  TextAction,
} from '../ui';
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

  // Source pane reflects the active mode. `wrap-native` shows the wrapped
  // contract; both `deploy-test` and `existing` show the canonical ERC-20
  // mock as a reference for the interface the bridge expects.
  const contracts = mode === 'wrap-native' ? ICTT_WRAPPED_NATIVE_SOURCES : ICTT_EXAMPLE_ERC20_SOURCES;

  return (
    <ContractDeployViewer contracts={contracts}>
      <Inspector
        label="Phase 1 · Source token"
        banner={
          showExistingBridgeBanner ? (
            <Alert variant="warning">
              <div className="flex flex-col items-start gap-2">
                <span>
                  This bridge already has a TokenHome. A new token here <strong>replaces</strong> it for the next
                  phases. Start a new bridge to keep this one as it is.
                </span>
                <TextAction icon={RotateCcw} onClick={onStartNewBridge}>
                  Start new bridge
                </TextAction>
              </div>
            </Alert>
          ) : null
        }
        footer={
          <Button
            onClick={() => onPhaseChange('home')}
            disabled={!underlyingTokenAddress}
            className="w-auto"
            icon={<ArrowRight className="h-3.5 w-3.5" aria-hidden />}
          >
            Continue to Home
          </Button>
        }
      >
        <div className="flex flex-col gap-5">
          <p className={BODY}>
            Pick the token to bridge from {selectedL1?.name ?? 'the Home chain'}. Deploy a test ERC-20, wrap the native
            coin, or paste a token you already have.
          </p>

          <OptionGrid label="Source token" cols={3}>
            <Option
              selected={mode === 'deploy-test'}
              onSelect={() => setMode('deploy-test')}
              icon={<OptionIcon icon={FlaskConical} />}
              title="Test ERC-20"
              description="Deploy a fresh token with 1,000,000 minted to you."
            />
            <Option
              selected={mode === 'wrap-native'}
              onSelect={() => setMode('wrap-native')}
              icon={<OptionIcon icon={Layers} />}
              title="Wrap native"
              description={`Bridge ${selectedL1?.coinName ?? 'the native coin'} through its wrapped ERC-20.`}
            />
            <Option
              selected={mode === 'existing'}
              onSelect={() => setMode('existing')}
              icon={<OptionIcon icon={Coins} />}
              title="Existing token"
              description="Paste the address of an ERC-20 you already deployed."
            />
          </OptionGrid>

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
      </Inspector>
    </ContractDeployViewer>
  );
}

function OptionIcon({ icon: Icon }: { icon: typeof Coins }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </span>
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
    <div className="flex flex-col gap-4">
      <SpecPlate className={`${FRAME} px-4`}>
        <SpecRow label="Contract">ExampleERC20</SpecRow>
        <SpecRow label="Supply">
          <span className={MONO}>1,000,000</span>
        </SpecRow>
        <SpecRow label="Minted to">{walletEVMAddress ? <HashChip value={walletEVMAddress} /> : 'Your wallet'}</SpecRow>
        <SpecRow label="Chain">{chainName}</SpecRow>
      </SpecPlate>

      <Button
        onClick={handleDeploy}
        loading={isDeploying}
        loadingText="Deploying ExampleERC20…"
        icon={<Check aria-hidden className="h-3.5 w-3.5" />}
      >
        Deploy ExampleERC20
      </Button>

      {existingAddress && <SelectedTokenChip address={existingAddress} chainName={chainName} />}
      {error && <Alert variant="error">{error.message}</Alert>}
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
    <div className="flex flex-col gap-4">
      <Field
        label={`Token contract address${chainName ? ` on ${chainName}` : ''}`}
        htmlFor="ictt-existing-token"
        hint="Bridging a native coin? Wrap it first (for example WAVAX) and paste the wrapped address."
      >
        <div className="flex">
          <input
            id="ictt-existing-token"
            type="text"
            spellCheck={false}
            value={pasted}
            onChange={(e) => setPasted(e.target.value.trim())}
            placeholder="0x…"
            className={MONO_FIELD}
          />
          <button type="button" onClick={handleVerify} disabled={!pasted || verifying} className={FIELD_ADDON}>
            {verifying ? 'Reading…' : 'Verify'}
          </button>
        </div>
      </Field>

      {verifyError && <Alert variant="error">{verifyError}</Alert>}

      {meta && (
        <SpecPlate className={`${FRAME} px-4`}>
          <SpecRow label="Name">{meta.name}</SpecRow>
          <SpecRow label="Symbol">
            <span className={MONO}>{meta.symbol}</span>
          </SpecRow>
          <SpecRow label="Decimals">
            <span className={MONO}>{meta.decimals}</span>
          </SpecRow>
          <SpecRow label="Address">
            <HashChip value={pasted} />
          </SpecRow>
        </SpecPlate>
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
    <div className="flex flex-col gap-4">
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
          <div className={`${FRAME} flex flex-col gap-2 px-4 py-4`}>
            <p className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-50">
              Wrapped {coinName} is already on {selectedL1?.name}
            </p>
            <p className={BODY}>
              Reuse it instead of deploying a new one. Deposit {coinName} to mint W{coinName}; withdraw to burn it.
            </p>
            <HashChip value={wrappedAddress as string} len={14} />
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
              className="flex h-10 items-center justify-center gap-2 border border-zinc-200 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-600 dark:border-zinc-800 dark:text-zinc-300"
              aria-disabled
            >
              <Check aria-hidden className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Selected as source token
            </div>
          ) : (
            <Button onClick={handleUseExisting} icon={<Check aria-hidden className="h-3.5 w-3.5" />}>
              Use this wrapped token
            </Button>
          )}
        </>
      ) : (
        <>
          <div className={`${FRAME} flex flex-col gap-1.5 px-4 py-4`}>
            <p className="text-[14px] font-semibold text-zinc-900 dark:text-zinc-50">
              Deploy WrappedNativeToken on {selectedL1?.name ?? 'the Home chain'}
            </p>
            <p className={BODY}>
              It mints W{coinName} when you deposit {coinName}. That wrapped ERC-20 is what the bridge carries.
            </p>
          </div>
          <Button
            onClick={handleDeploy}
            loading={isDeploying}
            loadingText="Deploying WrappedNativeToken…"
            icon={<Check aria-hidden className="h-3.5 w-3.5" />}
          >
            Deploy WrappedNativeToken
          </Button>
        </>
      )}

      {existingAddress && <SelectedTokenChip address={existingAddress} chainName={selectedL1?.name} />}
      {error && <Alert variant="error">{error.message}</Alert>}
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
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-px border border-zinc-200 bg-zinc-200 md:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-800">
        <WrapField
          id="ictt-wrap"
          label={`Wrap ${coinName}`}
          unit={coinName}
          amount={wrapAmount}
          onChange={setWrapAmount}
          onMax={() => nativeBalance !== null && setWrapAmount(formatBalance(nativeBalance, 18))}
          onSubmit={handleWrap}
          isBusy={busy === 'wrap'}
          submitLabel={`Wrap to W${coinName}`}
        />
        <WrapField
          id="ictt-unwrap"
          label={`Unwrap W${coinName}`}
          unit={`W${coinName}`}
          amount={unwrapAmount}
          onChange={setUnwrapAmount}
          onMax={() => wrappedBalance !== null && setUnwrapAmount(formatBalance(wrappedBalance, 18))}
          onSubmit={handleUnwrap}
          isBusy={busy === 'unwrap'}
          submitLabel={`Unwrap to ${coinName}`}
        />
      </div>
      {err && <Alert variant="error">{err}</Alert>}
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
    <div
      className={`grid grid-cols-1 gap-px border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800 ${showWrapped ? 'sm:grid-cols-2' : ''}`}
    >
      <BalanceCell label="Native balance" value={formatBalance(native, 18)} unit={coinName} />
      {showWrapped && <BalanceCell label="Wrapped balance" value={formatBalance(wrapped, 18)} unit={`W${coinName}`} />}
    </div>
  );
}

function BalanceCell({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex flex-col gap-1 bg-white px-4 py-3 dark:bg-zinc-950">
      <span className={EYEBROW}>{label}</span>
      <span className="font-mono text-[17px] tabular-nums text-zinc-900 dark:text-zinc-50">
        {value} <span className="text-[12px] text-zinc-400 dark:text-zinc-500">{unit}</span>
      </span>
    </div>
  );
}

interface WrapFieldProps {
  id: string;
  label: string;
  unit: string;
  amount: string;
  onChange: (value: string) => void;
  onMax: () => void;
  onSubmit: () => void;
  isBusy: boolean;
  submitLabel: string;
}

function WrapField({ id, label, unit, amount, onChange, onMax, onSubmit, isBusy, submitLabel }: WrapFieldProps) {
  return (
    <div className="flex flex-col gap-3 bg-white p-4 dark:bg-zinc-950">
      <Field label={label} htmlFor={id}>
        <div className="flex">
          <div className="relative min-w-0 flex-1">
            <input
              id={id}
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => onChange(e.target.value)}
              placeholder="0.0"
              className={`${MONO_FIELD} pr-16`}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-[10.5px] uppercase tracking-[0.12em] text-zinc-400">
              {unit}
            </span>
          </div>
          <button type="button" onClick={onMax} className={FIELD_ADDON}>
            Max
          </button>
        </div>
      </Field>
      <Button onClick={onSubmit} loading={isBusy} disabled={!amount} variant="outline" size="sm">
        {submitLabel}
      </Button>
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
    <div className="flex flex-wrap items-center justify-between gap-3 border border-emerald-300 px-4 py-3 dark:border-emerald-900">
      <div className="flex flex-col gap-0.5">
        <StatusTag tone="ok">Token selected</StatusTag>
        <span className="text-[12px] text-zinc-500 dark:text-zinc-400">on {chainName ?? 'Home chain'}</span>
      </div>
      <HashChip value={address} />
    </div>
  );
}
