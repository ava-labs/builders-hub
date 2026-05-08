'use client';

import { useEffect, useState } from 'react';
import ERC20TokenHomeABI from '@/contracts/icm-contracts/compiled/ERC20TokenHome.json';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useL1List, useL1ByChainId } from '@/components/toolbox/stores/l1ListStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Note } from '@/components/toolbox/components/Note';
import TeleporterRegistryAddressInput from '@/components/toolbox/components/TeleporterRegistryAddressInput';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import { useDeployTokenRemote } from '@/components/toolbox/console/ictt/hooks/useDeployTokenRemote';
import { InspectorPanel } from '../inspector-panel';
import { SegmentControl } from '../segment-control';
import { usePreflight } from '../use-preflight';
import type { BridgeState } from '../use-bridge-state';
import type { ActivityEvent, TokenKind } from '../types';

interface RemoteInspectorProps {
  bridge: BridgeState;
  accent: string;
  onAdvance: () => void;
  appendActivity: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => void;
  switchChain: (chainId: number, isTestnet: boolean) => Promise<void>;
}

/**
 * Remote phase: deploy the TokenRemote contract on the destination chain.
 * Source chain comes from the home phase (where TokenHome was deployed).
 *
 * The user must be connected to the *destination* chain to deploy here.
 * Token name/symbol/decimals are auto-fetched from the source chain's
 * token home, then passed to the constructor along with the source's
 * blockchain ID (cb58→hex).
 */
export function RemoteInspector({
  bridge,
  accent,
  onAdvance,
  appendActivity,
  switchChain,
}: RemoteInspectorProps) {
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const viemChain = useViemChainStore();
  const l1List = useL1List();
  const { run: runDeploy, isDeploying, error: deployError } = useDeployTokenRemote();

  const [kind, setKind] = useState<TokenKind>('erc20');
  // Destination chain to deploy on — defaults to "first non-home L1" so
  // the user gets a sensible suggestion. They can pick any other L1 from
  // the segment if they prefer.
  const [destChainId, setDestChainId] = useState<string>('');
  const [registry, setRegistry] = useState<string>('');
  const [manager, setManager] = useState<string>(walletEVMAddress || '');
  const [minVersion, setMinVersion] = useState('1');
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenDecimals, setTokenDecimals] = useState('0');
  // Native-only fields:
  const [initialReserve, setInitialReserve] = useState('1');
  const [burnReward, setBurnReward] = useState('0');
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);

  const destChain = useL1ByChainId(destChainId);
  const sourceL1 = bridge.homeChain;
  const { banner: preflight } = usePreflight({ expectedChain: destChain, switchChain });

  // Default destination = first L1 that isn't the home chain.
  useEffect(() => {
    if (destChainId || !sourceL1) return;
    const candidate = l1List.find((l1: { id: string }) => l1.id !== sourceL1.id);
    if (candidate) setDestChainId(candidate.id);
  }, [destChainId, sourceL1, l1List]);

  // Default registry from destination chain's well-known address.
  useEffect(() => {
    if (destChain?.wellKnownTeleporterRegistryAddress && !registry) {
      setRegistry(destChain.wellKnownTeleporterRegistryAddress);
    }
  }, [destChain?.id, registry]);

  // Auto-fetch token details from the source chain's TokenHome.
  useEffect(() => {
    if (!sourceL1?.rpcUrl || !bridge.homeAddress) return;
    setFetching(true);
    setError(null);
    const client = makePublicClientForChain(sourceL1.rpcUrl);
    if (!client) {
      setFetching(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const tokenAddr = await client.readContract({
          address: bridge.homeAddress as `0x${string}`,
          abi: ERC20TokenHomeABI.abi,
          functionName: 'getTokenAddress',
        });
        const [name, symbol, decimals] = await Promise.all([
          client.readContract({
            address: tokenAddr as `0x${string}`,
            abi: ExampleERC20.abi,
            functionName: 'name',
          }),
          client.readContract({
            address: tokenAddr as `0x${string}`,
            abi: ExampleERC20.abi,
            functionName: 'symbol',
          }),
          client.readContract({
            address: tokenAddr as `0x${string}`,
            abi: ExampleERC20.abi,
            functionName: 'decimals',
          }),
        ]);
        if (cancelled) return;
        setTokenName(name as string);
        setTokenSymbol(symbol as string);
        setTokenDecimals(String(decimals));
      } catch (e: any) {
        if (cancelled) return;
        setError(`Could not read source token: ${e?.shortMessage ?? e?.message ?? 'unknown'}`);
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sourceL1?.rpcUrl, bridge.homeAddress]);

  const handleDeploy = async () => {
    setError(null);
    if (!sourceL1 || !bridge.homeAddress) {
      setError('Deploy TokenHome first');
      return;
    }
    if (!destChain || !viemChain) {
      setError('Pick a destination chain');
      return;
    }

    try {
      const result = await runDeploy({
        kind,
        sourceChainId: sourceL1.id,
        sourceHomeAddress: bridge.homeAddress,
        sourceDecimals: tokenDecimals,
        registry,
        manager: manager || walletEVMAddress || '',
        minVersion,
        tokenName,
        tokenSymbol,
        initialReserveImbalance: kind === 'native' ? initialReserve : undefined,
        burnedFeesReportingRewardPercentage: kind === 'native' ? burnReward : undefined,
        destChainId: destChain.id,
      });

      appendActivity({
        kind: 'deploy',
        label: `${kind === 'erc20' ? 'ERC20TokenRemote' : 'NativeTokenRemote'} deployed on ${destChain.name}`,
        txHash: result.hash,
        chainId: viemChain.id,
      });
      onAdvance();
    } catch (e: any) {
      const msg = e?.shortMessage ?? e?.message ?? 'Deployment failed';
      appendActivity({ kind: 'error', label: `TokenRemote deploy failed: ${msg}` });
    }
  };

  return (
    <InspectorPanel
      phase="remote"
      accent={accent}
      title="Deploy TokenRemote"
      description="The mirror contract on the destination chain. Mints / burns wrapped representations of the home asset."
      meta="Will need collateral on Home before transfers can flow."
      primaryAction={
        <Button
          onClick={handleDeploy}
          loading={isDeploying}
          loadingText="Deploying..."
          disabled={!bridge.homeAddress || !destChain || tokenDecimals === '0' || isDeploying}
          stickLeft
        >
          Deploy TokenRemote →
        </Button>
      }
      preflight={preflight}
    >
      <div>
        <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Remote kind</label>
        <SegmentControl<TokenKind>
          value={kind}
          onChange={setKind}
          options={[
            { value: 'erc20', label: 'ERC20TokenRemote' },
            { value: 'native', label: 'NativeTokenRemote' },
          ]}
        />
      </div>

      <div>
        <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
          Destination chain
        </label>
        <select
          value={destChainId}
          onChange={(e) => setDestChainId(e.target.value)}
          className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-md text-sm"
        >
          <option value="" disabled>
            Pick a destination chain…
          </option>
          {l1List
            .filter((l1: { id: string }) => l1.id !== sourceL1?.id)
            .map((l1: { id: string; name: string; evmChainId: number }) => (
              <option key={l1.id} value={l1.id}>
                {l1.name} (chain id {l1.evmChainId})
              </option>
            ))}
        </select>
      </div>

      <TeleporterRegistryAddressInput value={registry} onChange={setRegistry} disabled={isDeploying} />

      <Input
        label="Teleporter Manager"
        value={manager}
        onChange={setManager}
        helperText="Defaults to your wallet address."
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Input label="Min version" value={minVersion} onChange={setMinVersion} type="number" unit="v" />
        <Input
          label="Decimals"
          value={tokenDecimals}
          disabled
          helperText={fetching ? 'Reading from source…' : 'From source token'}
        />
        {kind === 'erc20' ? (
          <>
            <Input label="Name" value={tokenName} disabled />
            <Input label="Symbol" value={tokenSymbol} disabled />
          </>
        ) : (
          <>
            <Input label="Initial reserve" value={initialReserve} onChange={setInitialReserve} type="number" />
            <Input label="Burn reward %" value={burnReward} onChange={setBurnReward} type="number" unit="%" />
          </>
        )}
      </div>

      {kind === 'native' && (
        <Note variant="warning">
          NativeTokenRemote needs the <strong>Native Minter precompile</strong> active on the destination chain.
        </Note>
      )}

      {!sourceL1 || !bridge.homeAddress ? (
        <Note variant="warning">
          Deploy <strong>TokenHome</strong> first (Home phase) so the remote knows where to register.
        </Note>
      ) : null}

      {(error || deployError) && (
        <Note variant="destructive">
          <p>{error || deployError}</p>
        </Note>
      )}
    </InspectorPanel>
  );
}
