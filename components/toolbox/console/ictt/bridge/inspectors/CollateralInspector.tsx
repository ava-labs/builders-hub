'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Check, RefreshCw } from 'lucide-react';
import { Alert } from '@/components/toolbox/components/Alert';
import { Button } from '@/components/toolbox/components/Button';
import { Steps, Step } from '@/components/toolbox/components/Steps';
import { HashChip } from '@/components/explorer-v2/ui';
import { useL1ByChainId } from '@/components/toolbox/stores/l1ListStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { ContractDeployViewer } from '@/components/console/contract-deploy-viewer';
import { ICTT_COLLATERAL_SOURCES } from '@/lib/ictt/contractSources';
import { useAddCollateral } from '../hooks/useAddCollateral';
import { BODY, EYEBROW, FIELD_ADDON, Field, Inspector, Loading, MONO_FIELD, MONO_MUTED, TextAction } from '../ui';
import type { Bridge, BridgePhase, Remote } from '../types';

interface CollateralInspectorProps {
  onPhaseChange: (next: BridgePhase) => void;
  bridge: Bridge | null;
  remote: Remote | null;
}

export function CollateralInspector({ onPhaseChange, bridge, remote }: CollateralInspectorProps) {
  const homeL1 = useL1ByChainId(bridge?.homeL1Id ?? '');
  const { walletEVMAddress } = useWalletStore();
  const {
    approve,
    addCollateral,
    stage,
    error,
    allowance,
    registered,
    collateralNeeded,
    refresh,
    pollState,
    pollAttempts,
    pollMaxAttempts,
    lastError,
  } = useAddCollateral({ bridge, remote });
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

  // Banner priority: hard prereq (no Phase 4 yet) > Home RPC failure > waiting
  // for ICM > "we're still polling but no signal yet". Each variant gives the
  // user exactly one thing to do (or to wait for).
  const isPollingForRegistration = pollState === 'polling' && registered !== true;
  const rpcErrorVisible = pollState === 'rpc-error' && registered !== true;
  const timeoutVisible = pollState === 'timeout' && registered !== true;

  return (
    <ContractDeployViewer contracts={ICTT_COLLATERAL_SOURCES}>
      <Inspector
        label="Phase 5 · Collateral"
        banner={
          !remote?.registeredAt ? (
            <Alert variant="warning">Register the Remote in Phase 4 before adding collateral.</Alert>
          ) : rpcErrorVisible ? (
            <Alert variant="error">
              <div className="flex flex-col items-start gap-2">
                <span>
                  Couldn&apos;t reach the {homeL1?.name ?? 'Home'} RPC after {pollAttempts}/{pollMaxAttempts} attempts
                  {lastError ? (
                    <>
                      {' '}
                      · <span className="font-mono text-[11px] opacity-80">{lastError.message}</span>
                    </>
                  ) : null}
                  .
                </span>
                <TextAction icon={RefreshCw} onClick={refresh}>
                  Refresh
                </TextAction>
              </div>
            </Alert>
          ) : timeoutVisible ? (
            <Alert variant="warning">
              <div className="flex flex-col items-start gap-2">
                <span>
                  Still waiting on the ICM relayer after {pollAttempts}/{pollMaxAttempts} attempts. The message may be
                  late; refresh in a few seconds.
                </span>
                <TextAction icon={RefreshCw} onClick={refresh}>
                  Refresh
                </TextAction>
              </div>
            </Alert>
          ) : isPollingForRegistration ? (
            <Loading className="normal-case tracking-normal">
              Waiting for the relayer to deliver the registration to {homeL1?.name ?? 'Home'}
              {pollAttempts > 0 ? ` · attempt ${pollAttempts}/${pollMaxAttempts}` : ''}
            </Loading>
          ) : remoteNotRegistered ? (
            <Alert variant="warning">
              <div className="flex flex-col items-start gap-2">
                <span>
                  The Remote isn&apos;t registered on {homeL1?.name ?? 'Home'} yet. The ICM message may still be in
                  flight.
                </span>
                <TextAction icon={RefreshCw} onClick={refresh}>
                  Refresh
                </TextAction>
              </div>
            </Alert>
          ) : null
        }
        footer={
          remote?.collateralizedAt || noCollateralRequired ? (
            <Button
              onClick={() => onPhaseChange('live')}
              className="w-auto"
              icon={<ArrowRight className="h-3.5 w-3.5" aria-hidden />}
            >
              Continue to Live
            </Button>
          ) : null
        }
      >
        <div className="flex flex-col gap-5">
          <p className={BODY}>
            Fund the bridge with {bridge?.symbol ?? 'the underlying token'} on {homeL1?.name ?? 'Home'}.{' '}
            {isNative
              ? 'A native home takes the gas coin directly.'
              : 'Two transactions: approve TokenHome to spend the amount, then add it as collateral.'}
          </p>

          <div className="grid grid-cols-1 gap-px border border-zinc-200 bg-zinc-200 sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-800">
            <div className="flex flex-col gap-1.5 bg-white px-4 py-3 dark:bg-zinc-950">
              <span className={EYEBROW}>TokenHome</span>
              {bridge?.homeAddress ? (
                <HashChip value={bridge.homeAddress} len={14} />
              ) : (
                <span className={MONO_MUTED}>—</span>
              )}
            </div>
            <div className="flex flex-col gap-1 bg-white px-4 py-3 dark:bg-zinc-950">
              <span className={EYEBROW}>Your balance</span>
              <span className="font-mono text-[17px] tabular-nums text-zinc-900 dark:text-zinc-50">
                {balance !== null ? formatAmount(balance, decimals) : '—'}{' '}
                <span className="text-[12px] text-zinc-400 dark:text-zinc-500">{bridge?.symbol ?? ''}</span>
              </span>
            </div>
          </div>

          {noCollateralRequired ? (
            <Alert variant="success">
              No collateral needed: decimals match and there&apos;s no reserve imbalance, so TokenHome is already fully
              backed. Continue to Phase 6.
            </Alert>
          ) : (
            <Field
              label={`Collateral amount${bridge?.symbol ? ` (${bridge.symbol})` : ''}`}
              htmlFor="ictt-collateral-amount"
              hint={
                isErc20 && allowance !== null && parsedAmount !== null && parsedAmount > 0n ? (
                  <span className="font-mono text-[11px] tabular-nums">
                    Current allowance {formatAmount(allowance, decimals)} {bridge?.symbol ?? ''}
                  </span>
                ) : undefined
              }
            >
              <div className="flex">
                <div className="relative min-w-0 flex-1">
                  <input
                    id="ictt-collateral-amount"
                    type="text"
                    inputMode="decimal"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="0.0"
                    className={`${MONO_FIELD} h-12 pr-16 text-[17px]`}
                  />
                  {bridge?.symbol && (
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500">
                      {bridge.symbol}
                    </span>
                  )}
                </div>
                {balance !== null && (
                  <button
                    type="button"
                    onClick={() => setAmountInput(formatAmount(balance, decimals))}
                    className={`${FIELD_ADDON} h-12`}
                  >
                    Max
                  </button>
                )}
              </div>
            </Field>
          )}

          {noCollateralRequired ? null : isErc20 ? (
            <div className="flex flex-col gap-4">
              <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                {parsedAmount === null || parsedAmount <= 0n
                  ? 'Enter an amount to see the two transactions.'
                  : allowance === null
                    ? 'Checking allowance…'
                    : hasAllowance
                      ? 'Approval done. The collateral transaction is ready to sign.'
                      : 'Approve TokenHome first. The second transaction unlocks once the approval confirms.'}
              </p>
              <Steps>
                <Step>
                  <h3>Approve TokenHome</h3>
                  <p>Lets TokenHome move the amount from your wallet.</p>
                  <Button
                    onClick={handleApprove}
                    loading={isApproving}
                    loadingText="Approving…"
                    variant={hasAllowance ? 'outline' : 'primary'}
                    icon={
                      hasAllowance ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                      ) : undefined
                    }
                    disabled={
                      busy ||
                      hasAllowance ||
                      parsedAmount === null ||
                      parsedAmount <= 0n ||
                      !bridge?.homeAddress ||
                      !remote?.address
                    }
                  >
                    {hasAllowance
                      ? `Approved ${formatAmount(parsedAmount ?? 0n, decimals)} ${bridge?.symbol ?? ''}`
                      : `Approve ${amountInput || '0'} ${bridge?.symbol ?? ''}`}
                  </Button>
                </Step>
                <Step>
                  <h3>Add collateral</h3>
                  <p>Locks the amount in TokenHome to back the Remote.</p>
                  <Button
                    onClick={handleAddCollateral}
                    loading={isDepositing}
                    loadingText="Adding collateral…"
                    disabled={
                      busy ||
                      !hasAllowance ||
                      !remoteRegisteredOnHome ||
                      parsedAmount === null ||
                      parsedAmount <= 0n ||
                      !bridge?.homeAddress ||
                      !remote?.address
                    }
                  >
                    Add collateral
                  </Button>
                  {registrationUnknown && hasAllowance && (
                    <Loading>Checking registration on {homeL1?.name ?? 'Home'}</Loading>
                  )}
                </Step>
              </Steps>
            </div>
          ) : (
            // Native home — single button (no approve needed).
            <Button
              onClick={handleAddCollateral}
              loading={isDepositing}
              loadingText="Sending native…"
              disabled={
                busy ||
                !remoteRegisteredOnHome ||
                parsedAmount === null ||
                parsedAmount <= 0n ||
                !bridge?.homeAddress ||
                !remote?.address
              }
            >
              Send native collateral
            </Button>
          )}

          {error && <Alert variant="error">{error.message}</Alert>}

          {remote?.collateralizedAt && (
            <Alert variant="success">Collateralized at {new Date(remote.collateralizedAt).toLocaleTimeString()}.</Alert>
          )}
        </div>
      </Inspector>
    </ContractDeployViewer>
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
