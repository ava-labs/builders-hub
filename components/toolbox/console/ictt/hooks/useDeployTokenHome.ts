'use client';

import { useState } from 'react';
import ERC20TokenHome from '@/contracts/icm-contracts/compiled/ERC20TokenHome.json';
import NativeTokenHome from '@/contracts/icm-contracts/compiled/NativeTokenHome.json';
import { useToolboxStore, useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useContractDeployer } from '@/components/toolbox/hooks/contracts';
import type { TokenKind } from '@/app/console/ictt/_components/types';

export interface DeployTokenHomeArgs {
  kind: TokenKind;
  /** Teleporter Registry address on the home chain */
  registry: string;
  /** Address authorized to update the registry; defaults to wallet */
  manager: string;
  /** Minimum Teleporter version */
  minVersion: string;
  /** Underlying ERC-20 (or wrapped-native) token address */
  tokenAddress: string;
  /** Token decimals; auto-fetched by inspector before calling run() */
  decimals: string;
}

export interface DeployTokenHomeResult {
  hash: string;
  contractAddress: string;
}

/**
 * Hook that owns the on-chain TokenHome deployment. Encapsulates the
 * contract-specific arg layout (`ERC20TokenHome` vs `NativeTokenHome`)
 * and the per-kind store write so the inspector only needs to collect
 * the form fields and call `run(args)`.
 */
export function useDeployTokenHome() {
  const { setErc20TokenHomeAddress, setNativeTokenHomeAddress } = useToolboxStore();
  const walletEVMAddress = useWalletStore((s) => s.walletEVMAddress);
  const viemChain = useViemChainStore();
  const { deploy, isDeploying } = useContractDeployer();
  const [error, setError] = useState<string | null>(null);

  const run = async (args: DeployTokenHomeArgs): Promise<DeployTokenHomeResult> => {
    setError(null);

    if (!viemChain) {
      const msg = 'Wallet not connected';
      setError(msg);
      throw new Error(msg);
    }
    if (!args.registry) {
      const msg = 'Teleporter Registry address is required';
      setError(msg);
      throw new Error(msg);
    }
    if (!args.tokenAddress) {
      const msg = 'Token address is required';
      setError(msg);
      throw new Error(msg);
    }

    const constructorArgs: any[] = [
      args.registry as `0x${string}`,
      (args.manager || walletEVMAddress) as `0x${string}`,
      BigInt(args.minVersion || '1'),
      args.tokenAddress as `0x${string}`,
    ];
    if (args.kind === 'erc20') constructorArgs.push(BigInt(args.decimals || '0'));

    try {
      const result = await deploy({
        abi: (args.kind === 'erc20' ? ERC20TokenHome.abi : NativeTokenHome.abi) as any,
        bytecode: args.kind === 'erc20' ? ERC20TokenHome.bytecode.object : NativeTokenHome.bytecode.object,
        args: constructorArgs,
        name: args.kind === 'erc20' ? 'ERC20TokenHome' : 'NativeTokenHome',
      });

      if (args.kind === 'erc20') {
        setErc20TokenHomeAddress(result.contractAddress);
      } else {
        setNativeTokenHomeAddress(result.contractAddress);
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
