'use client';

import { useEffect, useState } from 'react';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { useToolboxStore, useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import {
  useSelectedL1,
  useSetWrappedNativeToken,
  useWrappedNativeToken,
} from '@/components/toolbox/stores/l1ListStore';
import { useContractDeployer } from '@/components/toolbox/hooks/contracts';
import { Button } from '@/components/toolbox/components/Button';
import { EVMAddressInput } from '@/components/toolbox/components/EVMAddressInput';
import { Note } from '@/components/toolbox/components/Note';
import WrappedNativeToken from '@/contracts/icm-contracts/compiled/WrappedNativeToken.json';
import { makePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import { InspectorPanel } from '../inspector-panel';
import { SegmentControl } from '../segment-control';
import { usePreflight } from '../use-preflight';
import type { BridgeState } from '../use-bridge-state';
import type { ActivityEvent } from '../types';

type TokenSource = 'existing' | 'test' | 'wrapped';

interface TokenInspectorProps {
  bridge: BridgeState;
  accent: string;
  onAdvance: () => void;
  appendActivity: (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => void;
  switchChain: (chainId: number, isTestnet: boolean) => Promise<void>;
}

/**
 * Token phase: pick or deploy the home asset.
 *
 * Three segment options collapse the current branch flow:
 *   - existing: paste an ERC-20 contract address (saved as exampleErc20Address)
 *   - test:    deploy ExampleERC20 with 1M supply
 *   - wrapped: use or deploy the wrapped-native helper for native flows
 */
export function TokenInspector({
  bridge,
  accent,
  onAdvance,
  appendActivity,
  switchChain,
}: TokenInspectorProps) {
  const { exampleErc20Address, setExampleErc20Address } = useToolboxStore();
  const wrapped = useWrappedNativeToken();
  const setWrapped = useSetWrappedNativeToken();
  const selectedL1 = useSelectedL1();
  const viemChain = useViemChainStore();
  const { deploy, isDeploying } = useContractDeployer();
  const [source, setSource] = useState<TokenSource>(() =>
    exampleErc20Address ? 'test' : wrapped ? 'wrapped' : 'existing',
  );
  const [pasted, setPasted] = useState(exampleErc20Address || '');
  const [error, setError] = useState<string | null>(null);

  // Sync pasted field with store on first mount.
  useEffect(() => {
    if (!pasted && exampleErc20Address) setPasted(exampleErc20Address);
  }, [exampleErc20Address]);

  const { banner: preflight } = usePreflight({ expectedChain: bridge.homeChain, switchChain });

  const handleDeployTest = async () => {
    setError(null);
    try {
      const result = await deploy({
        abi: ExampleERC20.abi as any,
        bytecode: ExampleERC20.bytecode.object,
        args: [],
        name: 'ExampleERC20',
      });
      setExampleErc20Address(result.contractAddress);
      appendActivity({
        kind: 'deploy',
        label: `Test ERC-20 deployed on ${selectedL1?.name ?? 'home'}`,
        amount: '1M supply',
        txHash: result.hash,
        chainId: viemChain?.id,
      });
      onAdvance();
    } catch (e: any) {
      setError(e?.shortMessage ?? e?.message ?? 'Deployment failed');
      appendActivity({ kind: 'error', label: `Test ERC-20 deploy failed: ${e?.shortMessage ?? e?.message ?? ''}` });
    }
  };

  const handleDeployWrapped = async () => {
    setError(null);
    try {
      const result = await deploy({
        abi: WrappedNativeToken.abi as any,
        bytecode: WrappedNativeToken.bytecode.object,
        args: [selectedL1?.coinName ?? 'Native'],
        name: 'WrappedNativeToken',
      });
      setWrapped(result.contractAddress);
      appendActivity({
        kind: 'deploy',
        label: `Wrapped native deployed on ${selectedL1?.name ?? 'home'}`,
        txHash: result.hash,
        chainId: viemChain?.id,
      });
      onAdvance();
    } catch (e: any) {
      setError(e?.shortMessage ?? e?.message ?? 'Deployment failed');
    }
  };

  const handleUseExisting = async () => {
    setError(null);
    if (!pasted) {
      setError('Enter a token contract address');
      return;
    }
    if (!viemChain) {
      setError('Wallet not connected');
      return;
    }
    // Static-call the contract to verify it's a valid ERC-20 before saving.
    try {
      const client = makePublicClientForChain(viemChain.rpcUrls.default.http[0], [], viemChain);
      if (!client) throw new Error('Could not create RPC client');
      await client.readContract({
        address: pasted as `0x${string}`,
        abi: ExampleERC20.abi,
        functionName: 'decimals',
      });
      setExampleErc20Address(pasted);
      appendActivity({
        kind: 'deploy',
        label: `Token registered: ${pasted.slice(0, 6)}…${pasted.slice(-4)}`,
        chainId: viemChain.id,
      });
      onAdvance();
    } catch (e: any) {
      setError(`Not a valid ERC-20: ${e?.shortMessage ?? e?.message ?? 'unknown'}`);
    }
  };

  const action =
    source === 'existing' ? (
      <Button onClick={handleUseExisting} disabled={!pasted} stickLeft>
        Use this token →
      </Button>
    ) : source === 'test' ? (
      <Button onClick={handleDeployTest} loading={isDeploying} loadingText="Deploying..." stickLeft>
        Deploy test token →
      </Button>
    ) : (
      <Button onClick={handleDeployWrapped} loading={isDeploying} loadingText="Deploying..." stickLeft>
        Deploy wrapped native →
      </Button>
    );

  return (
    <InspectorPanel
      phase="token"
      accent={accent}
      title="Choose home asset"
      description="The token whose value will move across chains. Use an existing ERC-20, deploy a test token, or use the wrapped-native helper for native flows."
      meta={source === 'existing' ? 'Reads name, symbol, decimals via static call.' : 'Deploys to the home chain.'}
      primaryAction={action}
      preflight={preflight}
    >
      <div>
        <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">Token type</label>
        <SegmentControl<TokenSource>
          value={source}
          onChange={setSource}
          options={[
            { value: 'existing', label: 'Existing ERC-20' },
            { value: 'test', label: 'Deploy test token' },
            { value: 'wrapped', label: 'Wrapped native' },
          ]}
        />
      </div>

      {source === 'existing' && (
        <EVMAddressInput
          label="Token contract address"
          value={pasted}
          onChange={setPasted}
          helperText="Paste an existing ERC-20. Decimals are fetched via a static call."
        />
      )}

      {source === 'test' && (
        <Note variant="default">
          Will deploy <strong>ExampleERC20</strong> with 1,000,000 supply minted to your wallet on{' '}
          <strong>{selectedL1?.name ?? 'the home chain'}</strong>.
        </Note>
      )}

      {source === 'wrapped' && (
        <Note variant="default">
          {wrapped ? (
            <>
              Wrapped native already available at <code className="font-mono">{wrapped}</code>. Click below to confirm
              the choice.
            </>
          ) : (
            <>
              Will deploy <strong>WrappedNativeToken</strong> for{' '}
              <strong>{selectedL1?.coinName ?? 'native'}</strong> so the home contract can hold collateral.
            </>
          )}
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
