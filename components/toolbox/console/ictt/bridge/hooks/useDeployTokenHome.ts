'use client';

import { useState } from 'react';
import ERC20TokenHome from '@/contracts/icm-contracts/compiled/ERC20TokenHome.json';
import NativeTokenHome from '@/contracts/icm-contracts/compiled/NativeTokenHome.json';
import { useContractDeployer } from '@/components/toolbox/hooks/contracts';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useSelectedL1 } from '@/components/toolbox/stores/l1ListStore';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import type { Address, Bridge, BridgeId, HomeKind } from '../types';

export interface DeployTokenHomeParams {
  kind: HomeKind;
  teleporterRegistryAddress: Address;
  teleporterManager: Address;
  minTeleporterVersion: number;
  underlyingTokenAddress: Address;
  decimals: number;
  /** Optional metadata used for activity labels and Bridge symbol. */
  symbol?: string;
}

interface DeployResult {
  contractAddress: Address;
}

function makeBridgeId(homeL1Id: string, homeAddress: Address): BridgeId {
  return `bridge-${homeL1Id}-${homeAddress.toLowerCase()}` as BridgeId;
}

/**
 * Deploy + auto-initialize a TokenHome contract. The constructor takes
 * `(teleporterRegistry, teleporterManager, minTeleporterVersion, tokenAddress[, decimals])`
 * — initialization is part of deploy, no separate call.
 *
 * On success, creates a `Bridge` entry in `iccttBridgeStore` and pushes a
 * `deploy` activity event.
 */
export function useDeployTokenHome() {
  const { deploy, isDeploying } = useContractDeployer();
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const selectedL1 = useSelectedL1();
  const upsertBridge = useIcttBridgeStore((s) => s.upsertBridge);
  const setLastActiveBridge = useIcttBridgeStore((s) => s.setLastActiveBridge);
  const pushActivity = useIcttBridgeStore((s) => s.pushActivity);
  const [error, setError] = useState<Error | null>(null);

  const deployHome = async (
    params: DeployTokenHomeParams,
  ): Promise<{ bridgeId: BridgeId; address: Address } | null> => {
    setError(null);
    if (!selectedL1) {
      const e = new Error('No L1 selected for the Home chain');
      setError(e);
      return null;
    }
    try {
      const args: unknown[] = [
        params.teleporterRegistryAddress,
        params.teleporterManager,
        BigInt(params.minTeleporterVersion),
        params.underlyingTokenAddress,
      ];
      if (params.kind === 'erc20-home') {
        args.push(params.decimals);
      }

      const result = (await deploy({
        abi: (params.kind === 'erc20-home' ? ERC20TokenHome.abi : NativeTokenHome.abi) as unknown as never[],
        bytecode: params.kind === 'erc20-home' ? ERC20TokenHome.bytecode.object : NativeTokenHome.bytecode.object,
        args,
        name: params.kind === 'erc20-home' ? 'ERC20TokenHome' : 'NativeTokenHome',
      })) as DeployResult;

      const bridgeId = makeBridgeId(selectedL1.id, result.contractAddress);
      const bridge: Bridge = {
        id: bridgeId,
        kind: params.kind,
        homeL1Id: selectedL1.id,
        homeAddress: result.contractAddress,
        underlyingTokenAddress: params.underlyingTokenAddress,
        symbol: params.symbol,
        decimals: params.decimals,
        createdAt: Date.now(),
        remotes: [],
      };
      upsertBridge(bridge);
      setLastActiveBridge(bridgeId);

      pushActivity({
        bridgeId,
        kind: 'deploy',
        label: `TokenHome deployed on ${selectedL1.name}`,
        sublabel:
          params.kind === 'erc20-home'
            ? `ERC-20 home · ${params.symbol ?? 'token'} · ${params.decimals} decimals`
            : 'Native home',
        chainId: walletChainId,
        status: 'confirmed',
      });

      return { bridgeId, address: result.contractAddress };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      return null;
    }
  };

  return {
    deployHome,
    isDeploying,
    error,
  };
}
