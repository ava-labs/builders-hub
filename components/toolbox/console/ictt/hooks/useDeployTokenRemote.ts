'use client';

import { useState } from 'react';
import ERC20TokenRemote from '@/contracts/icm-contracts/compiled/ERC20TokenRemote.json';
import NativeTokenRemote from '@/contracts/icm-contracts/compiled/NativeTokenRemote.json';
import { getToolboxStore, useToolboxStore, useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useContractDeployer } from '@/components/toolbox/hooks/contracts';
import { cb58ToHex } from '@/components/tools/common/utils/cb58';
import type { TokenKind } from '@/app/console/ictt/_components/types';

export interface DeployTokenRemoteArgs {
  kind: TokenKind;
  /** Source chain blockchain ID (cb58) — where TokenHome lives */
  sourceChainId: string;
  /** TokenHome contract address on source chain */
  sourceHomeAddress: string;
  /** Source-chain token decimals (read from underlying token) */
  sourceDecimals: string;
  /** Teleporter Registry address on the destination chain */
  registry: string;
  /** Address authorized to update the registry; defaults to wallet */
  manager: string;
  /** Minimum Teleporter version */
  minVersion: string;
  /** ERC-20 only: token name */
  tokenName?: string;
  /** Token symbol — required for both ERC-20 and Native */
  tokenSymbol: string;
  /** Native only: initial reserve imbalance (wei) */
  initialReserveImbalance?: string;
  /** Native only: burned-fees reporting reward percentage (0-100) */
  burnedFeesReportingRewardPercentage?: string;
  /** Destination chain ID — used to mirror the deployed address into
   *  the destination chain's per-chain toolbox store. */
  destChainId: string;
}

export interface DeployTokenRemoteResult {
  hash: string;
  contractAddress: string;
}

/**
 * Hook that owns the on-chain TokenRemote deployment. Validates inputs,
 * encodes the source-chain blockchain ID (cb58→hex), packs the
 * constructor settings struct, and writes the deployed address to BOTH
 * the destination-chain's per-chain toolbox store (where the contract
 * lives) and the active toolbox store (legacy compatibility with the old
 * wizard's flow that wrote to whichever chain the wallet was on).
 */
export function useDeployTokenRemote() {
  const { setErc20TokenRemoteAddress, setNativeTokenRemoteAddress } = useToolboxStore();
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const viemChain = useViemChainStore();
  const { deploy, isDeploying } = useContractDeployer();
  const [error, setError] = useState<string | null>(null);

  const run = async (args: DeployTokenRemoteArgs): Promise<DeployTokenRemoteResult> => {
    setError(null);

    if (!viemChain) {
      const msg = 'Wallet not connected';
      setError(msg);
      throw new Error(msg);
    }
    if (!args.sourceChainId || !args.sourceHomeAddress) {
      const msg = 'Source chain + TokenHome address required';
      setError(msg);
      throw new Error(msg);
    }
    if (args.sourceChainId === args.destChainId) {
      const msg = 'Source and destination must be different chains';
      setError(msg);
      throw new Error(msg);
    }
    if (!args.registry) {
      const msg = 'Teleporter Registry address required on destination';
      setError(msg);
      throw new Error(msg);
    }
    if (args.sourceDecimals === '0') {
      const msg = 'Source token decimals not yet fetched';
      setError(msg);
      throw new Error(msg);
    }
    if (args.kind === 'native') {
      const reserve = BigInt(args.initialReserveImbalance || '0');
      if (reserve <= 0n) {
        const msg = 'Initial reserve imbalance must be greater than zero';
        setError(msg);
        throw new Error(msg);
      }
      const reward = parseInt(args.burnedFeesReportingRewardPercentage || '0');
      if (reward < 0 || reward > 100) {
        const msg = 'Burned-fees reward percentage must be 0–100';
        setError(msg);
        throw new Error(msg);
      }
    }

    let sourceBlockchainIDHex: string;
    try {
      sourceBlockchainIDHex = cb58ToHex(args.sourceChainId);
    } catch {
      const msg = 'Could not encode source blockchain ID';
      setError(msg);
      throw new Error(msg);
    }

    const settings = {
      teleporterRegistryAddress: args.registry as `0x${string}`,
      teleporterManager: (args.manager || walletEVMAddress) as `0x${string}`,
      minTeleporterVersion: BigInt(args.minVersion || '1'),
      tokenHomeBlockchainID: sourceBlockchainIDHex as `0x${string}`,
      tokenHomeAddress: args.sourceHomeAddress as `0x${string}`,
      tokenHomeDecimals: parseInt(args.sourceDecimals),
    };

    const constructorArgs =
      args.kind === 'erc20'
        ? [settings, args.tokenName || 'Bridged Token', args.tokenSymbol || 'BRDG', parseInt(args.sourceDecimals)]
        : [
            settings,
            args.tokenSymbol || 'BRDG',
            BigInt(args.initialReserveImbalance || '1'),
            BigInt(args.burnedFeesReportingRewardPercentage || '0'),
          ];

    try {
      const result = await deploy({
        abi: (args.kind === 'erc20' ? ERC20TokenRemote.abi : NativeTokenRemote.abi) as any,
        bytecode: args.kind === 'erc20' ? ERC20TokenRemote.bytecode.object : NativeTokenRemote.bytecode.object,
        args: constructorArgs,
        name: args.kind === 'erc20' ? 'ERC20TokenRemote' : 'NativeTokenRemote',
      });

      // Save to the destination chain's per-chain toolbox store. This is
      // the canonical location since per-chain storage is how the existing
      // toolboxStore is keyed.
      const destStore = getToolboxStore(args.destChainId).getState();
      if (args.kind === 'erc20') {
        destStore.setErc20TokenRemoteAddress(result.contractAddress);
        // Mirror to active store for legacy compatibility with code paths
        // that read from the currently-selected chain's store.
        setErc20TokenRemoteAddress(result.contractAddress);
      } else {
        destStore.setNativeTokenRemoteAddress(result.contractAddress);
        setNativeTokenRemoteAddress(result.contractAddress);
      }

      return { hash: result.hash, contractAddress: result.contractAddress };
    } catch (e: any) {
      const msg = e?.shortMessage ?? e?.message ?? 'Deployment failed';
      setError(msg);
      throw e;
    }
  };

  return { run, isDeploying, error, reset: () => setError(null) };
}
