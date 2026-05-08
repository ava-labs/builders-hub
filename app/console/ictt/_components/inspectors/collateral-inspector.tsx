'use client';

import { useEffect, useState } from 'react';
import { formatUnits, parseUnits } from 'viem';
import ERC20TokenHomeABI from '@/contracts/icm-contracts/compiled/ERC20TokenHome.json';
import NativeTokenHomeABI from '@/contracts/icm-contracts/compiled/NativeTokenHome.json';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { cb58ToHex } from '@/components/tools/common/utils/cb58';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Note } from '@/components/toolbox/components/Note';
import { InspectorPanel } from '../inspector-panel';
import { ChainMismatchBanner } from './preflight-banner';
import type { BridgeState } from '../use-bridge-state';
import type { ActivityEvent } from '../types';

interface CollateralInspectorProps {
  bridge: BridgeState;
  accent: string;
  onClose: () => void;
  onAdvance: () => void;
  appendActivity: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => void;
  switchChain: (chainId: number, isTestnet: boolean) => Promise<void>;
}

/**
 * Collateral phase: fund the Home contract so the bridge can mint on
 * Remote. ERC-20 home requires a two-step (approve + addCollateral)
 * sequence; native home sends value directly.
 */
export function CollateralInspector({
  bridge,
  accent,
  onClose,
  onAdvance,
  appendActivity,
  switchChain,
}: CollateralInspectorProps) {
  const walletClient = useResolvedWalletClient();
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();

  const [decimals, setDecimals] = useState<number>(18);
  const [tokenAddress, setTokenAddress] = useState<string | null>(null);
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [amount, setAmount] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<'idle' | 'approving' | 'depositing'>('idle');

  // For ERC20 path: read the token address (the home's `getTokenAddress`)
  // and the user's allowance. For native path, no approval is needed.
  useEffect(() => {
    if (!bridge.homeChain?.rpcUrl || !bridge.homeAddress) return;
    let cancelled = false;
    const client = makePublicClientForChain(bridge.homeChain.rpcUrl);
    if (!client) return;
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
        if (!cancelled) setError(`Read failed: ${e?.shortMessage ?? e?.message ?? ''}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bridge.homeChain?.rpcUrl, bridge.homeAddress, bridge.homeKind, walletEVMAddress, working]);

  // Pre-fill amount with collateralNeeded.
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
    setError(null);
    if (!walletClient?.account || !viemChain || !tokenAddress || !bridge.homeAddress) {
      setError('Wallet or token not ready');
      return;
    }
    setWorking('approving');
    try {
      const client = makePublicClientForChain(viemChain.rpcUrls.default.http[0], [], viemChain);
      if (!client) throw new Error('Could not create RPC client');
      const { request } = await client.simulateContract({
        address: tokenAddress as `0x${string}`,
        abi: ExampleERC20.abi,
        functionName: 'approve',
        args: [bridge.homeAddress as `0x${string}`, parsedAmount],
        chain: viemChain,
        account: walletClient.account,
      });
      const writePromise = walletClient.writeContract(request);
      notify({ type: 'call', name: 'Approve Token' }, writePromise, viemChain);
      const hash = await writePromise;
      await client.waitForTransactionReceipt({ hash });
      setAllowance(parsedAmount);
      appendActivity({ kind: 'collateral', label: 'Approved collateral spend', txHash: hash, chainId: viemChain.id });
    } catch (e: any) {
      const msg = e?.shortMessage ?? e?.message ?? 'Approve failed';
      setError(msg);
      appendActivity({ kind: 'error', label: `Approve failed: ${msg}` });
    } finally {
      setWorking('idle');
    }
  };

  const handleAddCollateral = async () => {
    setError(null);
    if (!walletClient?.account || !viemChain || !bridge.homeAddress || !bridge.remoteChain || !bridge.remoteAddress) {
      setError('Bridge not fully set up');
      return;
    }
    if (parsedAmount === 0n) {
      setError('Enter an amount');
      return;
    }
    let remoteHex: string;
    try {
      remoteHex = cb58ToHex(bridge.remoteChain.id);
    } catch {
      setError('Could not encode remote chain ID');
      return;
    }

    setWorking('depositing');
    try {
      const client = makePublicClientForChain(viemChain.rpcUrls.default.http[0], [], viemChain);
      if (!client) throw new Error('Could not create RPC client');

      const isNative = bridge.homeKind === 'native';
      const args = isNative
        ? [remoteHex, bridge.remoteAddress as `0x${string}`]
        : [remoteHex, bridge.remoteAddress as `0x${string}`, parsedAmount];

      const { request } = await client.simulateContract({
        address: bridge.homeAddress as `0x${string}`,
        abi: (isNative ? NativeTokenHomeABI.abi : ERC20TokenHomeABI.abi) as any,
        functionName: 'addCollateral',
        args,
        chain: viemChain,
        account: walletClient.account,
        ...(isNative ? { value: parsedAmount } : {}),
      });
      const writePromise = walletClient.writeContract(request);
      notify({ type: 'call', name: 'Add Collateral' }, writePromise, viemChain);
      const hash = await writePromise;
      await client.waitForTransactionReceipt({ hash });
      appendActivity({
        kind: 'collateral',
        label: `Collateral funded (${amount})`,
        amount,
        txHash: hash,
        chainId: viemChain.id,
      });
      bridge.refresh();
      onAdvance();
    } catch (e: any) {
      const msg = e?.shortMessage ?? e?.message ?? 'Add collateral failed';
      setError(msg);
      appendActivity({ kind: 'error', label: `Add collateral failed: ${msg}` });
    } finally {
      setWorking('idle');
    }
  };

  const onSwitchToHome = bridge.homeChain
    ? () => switchChain(bridge.homeChain!.evmChainId, !!bridge.homeChain!.isTestnet)
    : undefined;

  const collateralNeededFormatted =
    bridge.collateralNeeded > 0n ? formatUnits(bridge.collateralNeeded, decimals) : '0';

  // Progress: a heuristic since we only know `needed` (decreases as
  // funded). When needed = 0, we're 100% funded.
  const fullyFunded = bridge.registered && bridge.collateralNeeded === 0n;

  return (
    <InspectorPanel
      phase="collateral"
      accent={accent}
      title="Add collateral to Home"
      description="Fund the bridge so users can withdraw on the Remote side. Required before live transfers can flow."
      meta={
        fullyFunded
          ? 'Fully collateralized.'
          : `Remaining: ${collateralNeededFormatted} ${bridge.homeKind === 'native' ? bridge.homeChain?.coinName ?? 'tokens' : 'tokens'}`
      }
      primaryAction={
        fullyFunded ? (
          <Button onClick={onAdvance} variant="secondary" stickLeft>
            Continue → Live
          </Button>
        ) : needsApproval ? (
          <Button
            onClick={handleApprove}
            loading={working === 'approving'}
            loadingText="Approving..."
            disabled={parsedAmount === 0n || working !== 'idle'}
            stickLeft
          >
            Approve →
          </Button>
        ) : (
          <Button
            onClick={handleAddCollateral}
            loading={working === 'depositing'}
            loadingText="Depositing..."
            disabled={parsedAmount === 0n || working !== 'idle'}
            stickLeft
          >
            Add collateral →
          </Button>
        )
      }
      onClose={onClose}
      preflight={
        bridge.homeChain ? (
          <ChainMismatchBanner
            expectedChain={bridge.homeChain}
            walletChainId={walletChainId}
            onSwitch={onSwitchToHome}
          />
        ) : null
      }
    >
      <Input
        label={bridge.homeKind === 'native' ? `Amount (${bridge.homeChain?.coinName ?? 'native'})` : 'Amount (tokens)'}
        value={amount}
        onChange={setAmount}
        type="number"
        helperText={`Pre-filled with collateralNeeded (${collateralNeededFormatted}). Editable — partial funding allowed; top up later.`}
      />

      {bridge.homeKind === 'erc20' && (
        <Note variant="default">
          ERC-20 collateral needs two transactions: <strong>approve</strong> the home contract, then{' '}
          <strong>addCollateral</strong>.
        </Note>
      )}

      {/* Progress bar */}
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
