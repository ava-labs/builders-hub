'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Note } from '@/components/toolbox/components/Note';
import { useL1ByChainId } from '@/components/toolbox/stores/l1ListStore';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { InspectorShell } from './InspectorShell';
import { useAddCollateral } from '../hooks/useAddCollateral';
import { truncateAddress } from '../utils/explorer-url';
import type { Bridge, BridgePhase, BridgeStatus, Remote } from '../types';

interface CollateralInspectorProps {
  onPhaseChange: (next: BridgePhase) => void;
  status: BridgeStatus;
  bridge: Bridge | null;
  remote: Remote | null;
}

export function CollateralInspector({ onPhaseChange, status, bridge, remote }: CollateralInspectorProps) {
  const homeL1 = useL1ByChainId(bridge?.homeL1Id ?? '');
  const viemChain = useViemChainStore();
  const { walletEVMAddress } = useWalletStore();
  const { addCollateral, stage, isBusy, error } = useAddCollateral({ bridge, remote });
  const [amountInput, setAmountInput] = useState<string>('');
  const [balance, setBalance] = useState<bigint | null>(null);

  useEffect(() => {
    if (!bridge?.underlyingTokenAddress || !viemChain || !walletEVMAddress) return;
    let cancelled = false;
    const client = makePublicClientForChain(viemChain.rpcUrls.default.http[0], [], viemChain);
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
  }, [bridge?.underlyingTokenAddress, viemChain, walletEVMAddress]);

  const decimals = bridge?.decimals ?? 18;
  const parsedAmount = parseAmount(amountInput, decimals);

  const handleSubmit = async () => {
    if (parsedAmount === null || parsedAmount <= 0n) return;
    const result = await addCollateral(parsedAmount);
    if (result) onPhaseChange('live');
  };

  return (
    <InspectorShell
      phase="collateral"
      status={status}
      onPhaseChange={onPhaseChange}
      description={`Fund the bridge with ${bridge?.symbol ?? 'the underlying token'} on ${homeL1?.name ?? 'Home'}. ${
        bridge?.kind === 'native-home'
          ? 'Native home — sends gas directly.'
          : 'Two-step: approve TokenHome, then add collateral.'
      }`}
      banner={
        !remote?.registeredAt && (
          <Note variant="warning">
            <span className="text-xs">Register the Remote in Phase 4 before adding collateral.</span>
          </Note>
        )
      }
      footer={
        <>
          {remote?.collateralizedAt && (
            <button
              type="button"
              onClick={() => onPhaseChange('live')}
              className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              Continue to Live
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isBusy || !bridge?.homeAddress || !remote?.address || parsedAmount === null || parsedAmount <= 0n}
            className="inline-flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {stageLabel(stage, bridge?.kind === 'native-home')}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
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
        </label>

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

function stageLabel(stage: ReturnType<typeof useAddCollateral>['stage'], isNative: boolean): string {
  if (stage === 'approving') return 'Approving…';
  if (stage === 'depositing') return isNative ? 'Sending native…' : 'Adding collateral…';
  if (stage === 'done') return 'Add more collateral';
  return isNative ? 'Send native collateral' : 'Approve + add collateral';
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
