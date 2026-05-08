'use client';

import { useEffect, useState } from 'react';
import { formatUnits, parseUnits } from 'viem';
import ERC20TokenHomeABI from '@/contracts/icm-contracts/compiled/ERC20TokenHome.json';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import { useAddCollateral } from '@/components/toolbox/console/ictt/hooks/useAddCollateral';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Note } from '@/components/toolbox/components/Note';
import { InspectorPanel } from '../inspector-panel';
import { usePreflight } from '../use-preflight';
import { useKeyboardSubmit } from '../use-keyboard-submit';
import { FieldLoading } from '../field-loading';
import type { BridgeState } from '../use-bridge-state';
import type { ActivityEvent } from '../types';

interface CollateralInspectorProps {
  bridge: BridgeState;
  accent: string;
  onAdvance: () => void;
  appendActivity: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => void;
  switchChain: (chainId: number, isTestnet: boolean) => Promise<void>;
}

/**
 * Collateral phase: fund the Home contract so the bridge can mint on
 * Remote. ERC-20 home requires a two-step (approve + addCollateral)
 * sequence; native home sends value directly.
 *
 * On-chain mechanics live in `useAddCollateral`. This inspector owns
 * just the cross-chain reads (token address, decimals, allowance) used
 * to drive the UI's approve-vs-deposit gate.
 */
export function CollateralInspector({
  bridge,
  accent,
  onAdvance,
  appendActivity,
  switchChain,
}: CollateralInspectorProps) {
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const viemChain = useViemChainStore();
  const { approve, addCollateral, status, isApproving, isDepositing, error: hookError } = useAddCollateral();
  const { banner: preflight } = usePreflight({ expectedChain: bridge.homeChain, switchChain });

  const [decimals, setDecimals] = useState<number>(18);
  const [tokenAddress, setTokenAddress] = useState<string | null>(null);
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [amount, setAmount] = useState<string>('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);

  // For ERC20 path: read the token address from the home contract
  // (`getTokenAddress`) plus decimals + the user's allowance to gate the
  // approve-then-deposit flow. Native path needs no approval.
  useEffect(() => {
    if (!bridge.homeChain?.rpcUrl || !bridge.homeAddress) return;
    let cancelled = false;
    const client = makePublicClientForChain(bridge.homeChain.rpcUrl);
    if (!client) return;
    setIsReading(true);
    (async () => {
      try {
        if (bridge.homeKind === 'erc20') {
          const tokenAddr = (await client.readContract({
            address: bridge.homeAddress as `0x${string}`,
            abi: ERC20TokenHomeABI.abi,
            functionName: 'getTokenAddress',
          })) as `0x${string}`;
          if (cancelled) return;
          setTokenAddress(tokenAddr);
          const dec = (await client.readContract({
            address: tokenAddr,
            abi: ExampleERC20.abi,
            functionName: 'decimals',
          })) as bigint;
          if (cancelled) return;
          setDecimals(Number(dec));
          if (walletEVMAddress) {
            const allow = (await client.readContract({
              address: tokenAddr,
              abi: ExampleERC20.abi,
              functionName: 'allowance',
              args: [walletEVMAddress, bridge.homeAddress as `0x${string}`],
            })) as bigint;
            if (!cancelled) setAllowance(allow);
          }
        } else {
          if (!cancelled) setDecimals(18);
        }
      } catch (e: any) {
        if (!cancelled) setLocalError(`Read failed: ${e?.shortMessage ?? e?.message ?? ''}`);
      } finally {
        if (!cancelled) setIsReading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bridge.homeChain?.rpcUrl, bridge.homeAddress, bridge.homeKind, walletEVMAddress, status]);

  // Pre-fill amount with collateralNeeded when known.
  useEffect(() => {
    if (!amount && bridge.collateralNeeded > 0n) {
      setAmount(formatUnits(bridge.collateralNeeded, decimals));
    }
  }, [amount, bridge.collateralNeeded, decimals]);

  const parsedAmount = (() => {
    try {
      return amount ? parseUnits(amount, decimals) : 0n;
    } catch {
      return 0n;
    }
  })();

  const needsApproval = bridge.homeKind === 'erc20' && parsedAmount > allowance;

  const handleApprove = async () => {
    setLocalError(null);
    if (!tokenAddress || !bridge.homeAddress) {
      setLocalError('Token or home contract not loaded yet');
      return;
    }
    try {
      const result = await approve({
        tokenAddress,
        homeAddress: bridge.homeAddress,
        amount: parsedAmount,
      });
      setAllowance(parsedAmount);
      appendActivity({
        kind: 'collateral',
        label: 'Approved collateral spend',
        txHash: result.hash,
        chainId: viemChain?.id,
      });
    } catch (e: any) {
      const msg = e?.shortMessage ?? e?.message ?? 'Approve failed';
      appendActivity({ kind: 'error', label: `Approve failed: ${msg}` });
    }
  };

  const handleAddCollateral = async () => {
    setLocalError(null);
    if (!bridge.homeAddress || !bridge.remoteChain || !bridge.remoteAddress) {
      setLocalError('Bridge not fully set up');
      return;
    }
    try {
      const result = await addCollateral({
        homeAddress: bridge.homeAddress,
        homeKind: bridge.homeKind,
        remoteChainId: bridge.remoteChain.id,
        remoteAddress: bridge.remoteAddress,
        amount: parsedAmount,
      });
      appendActivity({
        kind: 'collateral',
        label: `Collateral funded (${amount})`,
        amount,
        txHash: result.hash,
        chainId: viemChain?.id,
      });
      bridge.refresh();
      onAdvance();
    } catch (e: any) {
      const msg = e?.shortMessage ?? e?.message ?? 'Add collateral failed';
      appendActivity({ kind: 'error', label: `Add collateral failed: ${msg}` });
    }
  };

  const collateralNeededFormatted =
    bridge.collateralNeeded > 0n ? formatUnits(bridge.collateralNeeded, decimals) : '0';

  // Progress is a heuristic — the contract only exposes `needed`, which
  // decreases as collateral lands. When `needed === 0`, we're 100% funded.
  const fullyFunded = bridge.registered && bridge.collateralNeeded === 0n;
  const error = localError || hookError;
  // Cmd+Enter binds to whichever primary action is currently visible:
  // Continue (when fully funded), Approve (when allowance < amount), or
  // Add collateral (otherwise).
  const submitHandler = fullyFunded ? onAdvance : needsApproval ? handleApprove : handleAddCollateral;
  const canSubmit = fullyFunded || (parsedAmount > 0n && status === 'idle');
  useKeyboardSubmit({ onSubmit: submitHandler, enabled: canSubmit });

  return (
    <InspectorPanel
      phase="collateral"
      accent={accent}
      title="Add collateral to Home"
      description="Fund the bridge so users can withdraw on the Remote side. Required before live transfers can flow."
      meta={
        fullyFunded
          ? 'Fully collateralized.'
          : `Remaining: ${collateralNeededFormatted} ${
              bridge.homeKind === 'native' ? bridge.homeChain?.coinName ?? 'tokens' : 'tokens'
            }`
      }
      showSubmitShortcut={canSubmit}
      primaryAction={
        fullyFunded ? (
          <Button onClick={onAdvance} variant="secondary" stickLeft>
            Continue → Live
          </Button>
        ) : needsApproval ? (
          <Button
            onClick={handleApprove}
            loading={isApproving}
            loadingText="Approving..."
            disabled={parsedAmount === 0n || status !== 'idle'}
            stickLeft
          >
            Approve →
          </Button>
        ) : (
          <Button
            onClick={handleAddCollateral}
            loading={isDepositing}
            loadingText="Depositing..."
            disabled={parsedAmount === 0n || status !== 'idle'}
            stickLeft
          >
            Add collateral →
          </Button>
        )
      }
      preflight={preflight}
    >
      <Input
        label={bridge.homeKind === 'native' ? `Amount (${bridge.homeChain?.coinName ?? 'native'})` : 'Amount (tokens)'}
        value={amount}
        onChange={setAmount}
        type="number"
        helperText={`Pre-filled with collateralNeeded (${collateralNeededFormatted}). Editable — partial funding allowed; top up later.`}
      />

      {isReading && <FieldLoading label="Reading decimals + allowance from home chain…" />}

      {bridge.homeKind === 'erc20' && (
        <Note variant="default">
          ERC-20 collateral needs two transactions: <strong>approve</strong> the home contract, then{' '}
          <strong>addCollateral</strong>.
        </Note>
      )}

      <div>
        <div className="flex items-center justify-between mb-2 text-xs">
          <span className="text-zinc-600 dark:text-zinc-400">Funded</span>
          <span className="font-mono text-zinc-900 dark:text-zinc-100">
            {fullyFunded ? '100%' : `${collateralNeededFormatted} remaining`}
          </span>
        </div>
        <div className="h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: fullyFunded ? '100%' : '0%', background: accent }}
          />
        </div>
      </div>

      {error && (
        <Note variant="destructive">
          <p>{error}</p>
        </Note>
      )}
    </InspectorPanel>
  );
}
