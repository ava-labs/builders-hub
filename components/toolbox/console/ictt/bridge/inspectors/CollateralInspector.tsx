'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Check, Loader2, RefreshCw } from 'lucide-react';
import { Note } from '@/components/toolbox/components/Note';
import { useL1ByChainId } from '@/components/toolbox/stores/l1ListStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { cn } from '@/lib/utils';
import { InspectorShell } from './InspectorShell';
import { useAddCollateral } from '../hooks/useAddCollateral';
import { truncateAddress } from '../utils/explorer-url';
import type { Bridge, BridgePhase, Remote } from '../types';

interface CollateralInspectorProps {
  onPhaseChange: (next: BridgePhase) => void;
  bridge: Bridge | null;
  remote: Remote | null;
}

export function CollateralInspector({ onPhaseChange, bridge, remote }: CollateralInspectorProps) {
  const homeL1 = useL1ByChainId(bridge?.homeL1Id ?? '');
  const { walletEVMAddress } = useWalletStore();
  const { approve, addCollateral, stage, error, allowance, registered, collateralNeeded, refresh } = useAddCollateral({
    bridge,
    remote,
  });
  const [amountInput, setAmountInput] = useState<string>('');
  const [balance, setBalance] = useState<bigint | null>(null);

  // Balance must target the Home L1's RPC regardless of the wallet's current
  // chain — otherwise the read fails when the user lands on this phase straight
  // from Phase 4 (which lives on the Remote chain).
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
  const parsedAmount = parseAmount(amountInput, decimals);
  const isErc20 = bridge?.kind === 'erc20-home';
  const isNative = bridge?.kind === 'native-home';
  const hasAllowance = parsedAmount !== null && allowance !== null && allowance >= parsedAmount;
  const isApproving = stage === 'approving';
  const isDepositing = stage === 'depositing';
  const busy = isApproving || isDepositing;

  // Registration on Home is the gate that actually matters. Phase 4 marks the
  // remote registered optimistically the moment the local tx confirms, but the
  // Home contract only knows after the ICM relayer delivers the message. Block
  // addCollateral until the Home-side check returns `registered: true`.
  const remoteRegisteredOnHome = registered === true;
  const registrationUnknown = registered === null;
  const remoteNotRegistered = registered === false;
  // Contracts with matching decimals and no initialReserveImbalance need zero
  // collateral. The hook auto-marks `collateralizedAt` in that case so the
  // user can move on; show a success card instead of the two-button row.
  const noCollateralRequired = isErc20 && remoteRegisteredOnHome && collateralNeeded === 0n;

  const handleApprove = async () => {
    if (!parsedAmount || parsedAmount <= 0n) return;
    await approve(parsedAmount);
  };

  const handleAddCollateral = async () => {
    if (!parsedAmount || parsedAmount <= 0n) return;
    const result = await addCollateral(parsedAmount);
    if (result) onPhaseChange('live');
  };

  return (
    <InspectorShell
      banner={
        remoteNotRegistered ? (
          <Note variant="warning">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span>
                Remote not registered on {homeL1?.name ?? 'Home'} yet — the ICM message may still be in flight. Wait a
                moment or refresh.
              </span>
              <button
                type="button"
                onClick={refresh}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800/60"
              >
                <RefreshCw className="h-3 w-3" aria-hidden />
                Refresh
              </button>
            </div>
          </Note>
        ) : !remote?.registeredAt ? (
          <Note variant="warning">
            <span className="text-xs">Register the Remote in Phase 4 before adding collateral.</span>
          </Note>
        ) : null
      }
      footer={
        remote?.collateralizedAt || noCollateralRequired ? (
          <button
            type="button"
            onClick={() => onPhaseChange('live')}
            className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Continue to Live
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Fund the bridge with {bridge?.symbol ?? 'the underlying token'} on {homeL1?.name ?? 'Home'}.{' '}
          {isNative
            ? 'Native home — sends gas directly.'
            : 'Two-step: approve TokenHome to spend the amount, then add collateral.'}
        </p>
        <div className="flex items-center justify-between rounded-xl border border-zinc-200/80 bg-zinc-50/60 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400">TokenHome</span>
            <code className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
              {truncateAddress(bridge?.homeAddress)}
            </code>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase tracking-wider text-zinc-400">Your balance</span>
            <span className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
              {balance !== null ? `${formatAmount(balance, decimals)} ${bridge?.symbol ?? ''}` : '—'}
            </span>
          </div>
        </div>

        {noCollateralRequired ? (
          <Note variant="success">
            <span className="text-xs">
              No collateral is required for this bridge — decimals match and there&apos;s no reserve imbalance, so
              TokenHome is already fully backed. You can continue to Phase 6.
            </span>
          </Note>
        ) : (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
              Collateral amount {bridge?.symbol ? `(${bridge.symbol})` : ''}
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0.0"
                className="w-full rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              {balance !== null && (
                <button
                  type="button"
                  onClick={() => setAmountInput(formatAmount(balance, decimals))}
                  className="rounded-md border border-zinc-200 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                >
                  Max
                </button>
              )}
            </div>
            {isErc20 && allowance !== null && parsedAmount !== null && parsedAmount > 0n && (
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                Current allowance · {formatAmount(allowance, decimals)} {bridge?.symbol ?? ''}
              </span>
            )}
          </label>
        )}

        {noCollateralRequired ? null : isErc20 ? (
          <div className="flex flex-col gap-2">
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {parsedAmount === null || parsedAmount <= 0n
                ? 'Enter an amount to see the two transactions.'
                : allowance === null
                  ? 'Checking allowance…'
                  : hasAllowance
                    ? 'Step 1 done — the collateral transaction is ready to sign.'
                    : 'Step 1: approve TokenHome. Step 2 unlocks once the approval confirms on-chain.'}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleApprove}
                disabled={
                  busy ||
                  hasAllowance ||
                  parsedAmount === null ||
                  parsedAmount <= 0n ||
                  !bridge?.homeAddress ||
                  !remote?.address
                }
                className={cn(
                  'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors',
                  hasAllowance
                    ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300'
                    : 'bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white',
                )}
              >
                {isApproving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : hasAllowance ? (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                ) : null}
                {hasAllowance
                  ? `Approved (${formatAmount(parsedAmount ?? 0n, decimals)} ${bridge?.symbol ?? ''})`
                  : `1. Approve ${amountInput || '0'} ${bridge?.symbol ?? ''}`}
              </button>
              <button
                type="button"
                onClick={handleAddCollateral}
                disabled={
                  busy ||
                  !hasAllowance ||
                  !remoteRegisteredOnHome ||
                  parsedAmount === null ||
                  parsedAmount <= 0n ||
                  !bridge?.homeAddress ||
                  !remote?.address
                }
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                {isDepositing && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                {isDepositing ? 'Adding collateral…' : `2. Add collateral`}
              </button>
            </div>
            {registrationUnknown && hasAllowance && (
              <p className="text-[10px] italic text-zinc-500 dark:text-zinc-400">
                Verifying registration on {homeL1?.name ?? 'Home'}…
              </p>
            )}
          </div>
        ) : (
          // Native home — single button (no approve needed).
          <button
            type="button"
            onClick={handleAddCollateral}
            disabled={
              busy ||
              !remoteRegisteredOnHome ||
              parsedAmount === null ||
              parsedAmount <= 0n ||
              !bridge?.homeAddress ||
              !remote?.address
            }
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {isDepositing && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {isDepositing ? 'Sending native…' : 'Send native collateral'}
          </button>
        )}

        {error && (
          <Note variant="destructive">
            <span className="text-xs">{error.message}</span>
          </Note>
        )}

        {remote?.collateralizedAt && (
          <Note variant="success">
            <span className="text-xs">Collateralized at {new Date(remote.collateralizedAt).toLocaleTimeString()}.</span>
          </Note>
        )}
      </div>
    </InspectorShell>
  );
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
