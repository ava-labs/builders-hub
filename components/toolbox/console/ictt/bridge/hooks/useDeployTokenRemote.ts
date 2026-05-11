'use client';

import { useState } from 'react';
import ERC20TokenRemote from '@/contracts/icm-contracts/compiled/ERC20TokenRemote.json';
import NativeTokenRemote from '@/contracts/icm-contracts/compiled/NativeTokenRemote.json';
import { cb58ToHex } from '@/components/tools/common/utils/cb58';
import { useContractDeployer } from '@/components/toolbox/hooks/contracts';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useL1ByChainId, useSelectedL1 } from '@/components/toolbox/stores/l1ListStore';
import { useIcttBridgeStore } from '@/components/toolbox/stores/iccttBridgeStore';
import type { Address, BridgeId, Remote, RemoteId, RemoteKind } from '../types';

export interface DeployTokenRemoteParams {
  bridgeId: BridgeId;
  homeL1Id: string;
  homeAddress: Address;
  homeDecimals: number;
  kind: RemoteKind;
  teleporterRegistryAddress: Address;
  teleporterManager: Address;
  minTeleporterVersion: number;
  tokenName: string;
  tokenSymbol: string;
  /** Optional initial reserve for native remote. */
  initialReserveImbalance?: bigint;
  /** Optional `multiplyOnRemote` flag for native remote. */
  multiplyOnRemote?: boolean;
  /** Optional decimal overrides. */
  decimals?: number;
}

interface DeployResult {
  contractAddress: Address;
}

function makeRemoteId(remoteL1Id: string, remoteAddress: Address): RemoteId {
  return `remote-${remoteL1Id}-${remoteAddress.toLowerCase()}` as RemoteId;
}

export function useDeployTokenRemote(remoteL1Id: string | null) {
  const { deploy, isDeploying } = useContractDeployer();
  const walletChainId = useWalletStore((s) => s.walletChainId);
  const remoteL1 = useL1ByChainId(remoteL1Id ?? '');
  const selectedL1 = useSelectedL1();
  const activeRemoteL1 = remoteL1 ?? selectedL1 ?? null;
  const upsertRemote = useIcttBridgeStore((s) => s.upsertRemote);
  const pushActivity = useIcttBridgeStore((s) => s.pushActivity);
  const setPendingDestinationL1Id = useIcttBridgeStore((s) => s.setPendingDestinationL1Id);
  const [error, setError] = useState<Error | null>(null);

  const deployRemote = async (
    params: DeployTokenRemoteParams,
  ): Promise<{ remoteId: RemoteId; address: Address } | null> => {
    setError(null);
    if (!activeRemoteL1) {
      const e = new Error('No destination L1 selected');
      setError(e);
      return null;
    }
    try {
      const tokenHomeBlockchainID = cb58ToHex(params.homeL1Id) as Address;
      const decimals = params.decimals ?? params.homeDecimals;

      const settings = {
        teleporterRegistryAddress: params.teleporterRegistryAddress,
        teleporterManager: params.teleporterManager,
        minTeleporterVersion: BigInt(params.minTeleporterVersion),
        tokenHomeBlockchainID,
        tokenHomeAddress: params.homeAddress,
        tokenHomeDecimals: params.homeDecimals,
      };

      const args: unknown[] =
        params.kind === 'erc20-remote'
          ? [settings, params.tokenName, params.tokenSymbol, decimals]
          : [settings, params.tokenName, params.initialReserveImbalance ?? 0n, params.multiplyOnRemote ?? false];

      const result = (await deploy({
        abi: (params.kind === 'erc20-remote' ? ERC20TokenRemote.abi : NativeTokenRemote.abi) as unknown as never[],
        bytecode: params.kind === 'erc20-remote' ? ERC20TokenRemote.bytecode.object : NativeTokenRemote.bytecode.object,
        args,
        name: params.kind === 'erc20-remote' ? 'ERC20TokenRemote' : 'NativeTokenRemote',
      })) as DeployResult;

      const remoteId = makeRemoteId(activeRemoteL1.id, result.contractAddress);
      const remote: Remote = {
        id: remoteId,
        kind: params.kind,
        l1Id: activeRemoteL1.id,
        address: result.contractAddress,
      };
      upsertRemote(params.bridgeId, remote);
      // Bridge now owns this Remote — clear the pending destination so the
      // ribbon flips from "Pending deploy" to the deployed variant.
      setPendingDestinationL1Id(null);

      pushActivity({
        bridgeId: params.bridgeId,
        remoteId,
        kind: 'deploy',
        label: `TokenRemote deployed on ${activeRemoteL1.name}`,
        sublabel:
          params.kind === 'erc20-remote'
            ? `ERC-20 remote · ${params.tokenSymbol} · ${decimals} decimals`
            : 'Native remote',
        chainId: walletChainId,
        status: 'confirmed',
      });

      return { remoteId, address: result.contractAddress };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      return null;
    }
  };

  return {
    deployRemote,
    isDeploying,
    error,
  };
}
