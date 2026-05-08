'use client';

import { useEffect, useState } from 'react';
import ERC20TokenHome from '@/contracts/icm-contracts/compiled/ERC20TokenHome.json';
import NativeTokenHome from '@/contracts/icm-contracts/compiled/NativeTokenHome.json';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { useToolboxStore, useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useContractDeployer } from '@/components/toolbox/hooks/contracts';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Note } from '@/components/toolbox/components/Note';
import TeleporterRegistryAddressInput from '@/components/toolbox/components/TeleporterRegistryAddressInput';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import { InspectorPanel } from '../inspector-panel';
import { SegmentControl } from '../segment-control';
import { ChainMismatchBanner } from './preflight-banner';
import type { BridgeState } from '../use-bridge-state';
import type { ActivityEvent, TokenKind } from '../types';

interface HomeInspectorProps {
  bridge: BridgeState;
  accent: string;
  onClose: () => void;
  onAdvance: () => void;
  appendActivity: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => void;
  switchChain: (chainId: number, isTestnet: boolean) => Promise<void>;
}

/**
 * Home phase: deploy the TokenHome contract on the origin chain. Fields
 * pulled from `DeployTokenHome.tsx` but condensed to the bare minimum —
 * registry, manager, min version, kind. Token address comes from the
 * previous (token) phase. Decimals auto-fetched.
 */
export function HomeInspector({
  bridge,
  accent,
  onClose,
  onAdvance,
  appendActivity,
  switchChain,
}: HomeInspectorProps) {
  const { setErc20TokenHomeAddress, setNativeTokenHomeAddress } = useToolboxStore();
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const viemChain = useViemChainStore();
  const { deploy, isDeploying } = useContractDeployer();

  const [kind, setKind] = useState<TokenKind>('erc20');
  const [registry, setRegistry] = useState(bridge.homeChain?.wellKnownTeleporterRegistryAddress ?? '');
  const [manager, setManager] = useState<string>(walletEVMAddress || '');
  const [minVersion, setMinVersion] = useState('1');
  const [decimals, setDecimals] = useState('18');
  const [error, setError] = useState<string | null>(null);

  // Auto-fetch decimals from the chosen token.
  useEffect(() => {
    if (!bridge.tokenAddress || !viemChain) return;
    const client = makePublicClientForChain(viemChain.rpcUrls.default.http[0], [], viemChain);
    if (!client) return;
    let cancelled = false;
    client
      .readContract({
        address: bridge.tokenAddress as `0x${string}`,
        abi: ExampleERC20.abi,
        functionName: 'decimals',
      })
      .then((d) => !cancelled && setDecimals(String(d)))
      .catch(() => !cancelled && setError('Could not read decimals from token'));
    return () => {
      cancelled = true;
    };
  }, [bridge.tokenAddress, viemChain?.id]);

  // Update manager default once wallet connects.
  useEffect(() => {
    if (walletEVMAddress && !manager) setManager(walletEVMAddress);
  }, [walletEVMAddress, manager]);

  // Update registry default when home chain changes.
  useEffect(() => {
    if (bridge.homeChain?.wellKnownTeleporterRegistryAddress && !registry) {
      setRegistry(bridge.homeChain.wellKnownTeleporterRegistryAddress);
    }
  }, [bridge.homeChain?.id, registry]);

  const handleDeploy = async () => {
    setError(null);
    if (!registry) {
      setError('Teleporter Registry address is required');
      return;
    }
    if (!bridge.tokenAddress) {
      setError('Pick or deploy a token first (Token phase)');
      return;
    }
    if (!viemChain) {
      setError('Wallet not connected');
      return;
    }

    try {
      const args: any[] = [
        registry as `0x${string}`,
        (manager || walletEVMAddress) as `0x${string}`,
        BigInt(minVersion || '1'),
        bridge.tokenAddress as `0x${string}`,
      ];
      if (kind === 'erc20') args.push(BigInt(decimals));

      const result = await deploy({
        abi: (kind === 'erc20' ? ERC20TokenHome.abi : NativeTokenHome.abi) as any,
        bytecode: kind === 'erc20' ? ERC20TokenHome.bytecode.object : NativeTokenHome.bytecode.object,
        args,
        name: kind === 'erc20' ? 'ERC20TokenHome' : 'NativeTokenHome',
      });

      if (kind === 'erc20') {
        setErc20TokenHomeAddress(result.contractAddress);
      } else {
        setNativeTokenHomeAddress(result.contractAddress);
      }
      appendActivity({
        kind: 'deploy',
        label: `${kind === 'erc20' ? 'ERC20TokenHome' : 'NativeTokenHome'} deployed on ${bridge.homeChain?.name ?? 'home'}`,
        txHash: result.hash,
        chainId: viemChain.id,
      });
      onAdvance();
    } catch (e: any) {
      const msg = e?.shortMessage ?? e?.message ?? 'Deployment failed';
      setError(msg);
      appendActivity({ kind: 'error', label: `TokenHome deploy failed: ${msg}` });
    }
  };

  const onSwitchToHome = bridge.homeChain
    ? () => switchChain(bridge.homeChain!.evmChainId, !!bridge.homeChain!.isTestnet)
    : undefined;

  return (
    <InspectorPanel
      phase="home"
      accent={accent}
      title="Deploy TokenHome"
      description="The custodian contract that holds the canonical supply on the origin chain."
      meta="Will become the home of the bridge."
      primaryAction={
        <Button
          onClick={handleDeploy}
          loading={isDeploying}
          loadingText="Deploying..."
          disabled={!bridge.tokenAddress || !registry}
          stickLeft
        >
          Deploy TokenHome →
        </Button>
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
      <div>
        <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
          Transferrer kind
        </label>
        <SegmentControl<TokenKind>
          value={kind}
          onChange={setKind}
          options={[
            { value: 'erc20', label: 'ERC20TokenHome' },
            { value: 'native', label: 'NativeTokenHome' },
          ]}
        />
      </div>

      <TeleporterRegistryAddressInput value={registry} onChange={setRegistry} disabled={isDeploying} />

      <Input
        label="Teleporter Manager"
        value={manager}
        onChange={setManager}
        disabled={isDeploying}
        helperText="Address authorized to update the registry. Defaults to your wallet."
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Min Teleporter Version"
          value={minVersion}
          onChange={setMinVersion}
          type="number"
          unit="v"
        />
        {kind === 'erc20' && <Input label="Decimals" value={decimals} disabled helperText="Auto-fetched" />}
      </div>

      {!bridge.tokenAddress && (
        <Note variant="warning">
          Select a token in the <strong>Token</strong> phase first.
        </Note>
      )}

      {error && (
        <Note variant="destructive">
          <p>{error}</p>
        </Note>
      )}
    </InspectorPanel>
  );
}
