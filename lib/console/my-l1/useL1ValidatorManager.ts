'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PublicClient } from 'viem';
import ValidatorManagerAbi from '@/contracts/icm-contracts/compiled/ValidatorManager.json';
import NativeTokenStakingManager from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import ERC20TokenStakingManager from '@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json';
import { useVMCAddress } from '@/components/toolbox/hooks/useVMCAddress';
import { usePublicClientForChain } from '@/components/toolbox/hooks/usePublicClientForChain';
import { isPrimaryNetwork, type CombinedL1 } from './types';
import type { ValidatorManagerKind } from './validator-manager-routing';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export interface L1ValidatorManagerInfo {
  address?: string;
  blockchainId?: string;
  kind: ValidatorManagerKind | null;
  isLoading: boolean;
  error: string | null;
}

type StakingDetection = Exclude<ValidatorManagerKind, 'poa'> | null;

export function useL1ValidatorManager(l1: CombinedL1): L1ValidatorManagerInfo {
  // Skip detection entirely for C-Chain (Primary Network) — it has no
  // Validator Manager Contract. We still call useVMCAddress every render
  // (hooks rule), but pass a sentinel that the inner hook short-circuits
  // on cleanly so its internal state doesn't churn.
  const shouldResolve = !isPrimaryNetwork(l1);
  const vmc = useVMCAddress(shouldResolve ? l1.subnetId : '');
  const address = l1.validatorManagerAddress || vmc.validatorManagerAddress || undefined;
  const blockchainId = l1.validatorManagerBlockchainId || vmc.blockchainId || undefined;
  const client = usePublicClientForChain(blockchainId ?? (address ? l1.rpcUrl : undefined));
  const [state, setState] = useState<{
    kind: ValidatorManagerKind | null;
    isDetecting: boolean;
    error: string | null;
  }>({ kind: null, isDetecting: false, error: null });

  useEffect(() => {
    let cancelled = false;

    const detect = async () => {
      if (!shouldResolve || !address || !client) {
        setState({ kind: null, isDetecting: false, error: null });
        return;
      }

      setState((s) => ({ ...s, isDetecting: true, error: null }));
      try {
        const directStaking = await detectStakingManager(client, address);
        if (cancelled) return;
        if (directStaking) {
          setState({ kind: directStaking, isDetecting: false, error: null });
          return;
        }

        const owner = (await client.readContract({
          address: address as `0x${string}`,
          abi: ValidatorManagerAbi.abi,
          functionName: 'owner',
        })) as string;

        if (cancelled) return;
        let ownerIsContract = false;
        try {
          const bytecode = await client.getBytecode({ address: owner as `0x${string}` });
          ownerIsContract = !!bytecode && bytecode !== '0x';
        } catch {
          ownerIsContract = false;
        }

        if (ownerIsContract) {
          const ownerStaking = await detectStakingManager(client, owner);
          if (cancelled) return;
          if (ownerStaking) {
            setState({ kind: ownerStaking, isDetecting: false, error: null });
            return;
          }
        }

        setState({ kind: 'poa', isDetecting: false, error: null });
      } catch (err) {
        if (cancelled) return;
        setState({
          kind: null,
          isDetecting: false,
          error: err instanceof Error ? err.message : 'Failed to detect validator manager type',
        });
      }
    };

    detect();
    return () => {
      cancelled = true;
    };
  }, [address, client, shouldResolve]);

  return useMemo(
    () => {
      // Stable no-op for the Primary Network — never report loading/error
      // state since we never even attempt detection.
      if (!shouldResolve) {
        return { address: undefined, blockchainId: undefined, kind: null, isLoading: false, error: null };
      }
      return {
        address,
        blockchainId,
        kind: state.kind,
        isLoading: Boolean(vmc.isLoading || state.isDetecting),
        error: state.error,
      };
    },
    [shouldResolve, address, blockchainId, state.kind, state.isDetecting, state.error, vmc.isLoading],
  );
}

async function detectStakingManager(client: PublicClient, address: string): Promise<StakingDetection> {
  try {
    await client.readContract({
      address: address as `0x${string}`,
      abi: NativeTokenStakingManager.abi,
      functionName: 'getStakingManagerSettings',
    });
  } catch {
    return null;
  }

  try {
    const token = (await client.readContract({
      address: address as `0x${string}`,
      abi: ERC20TokenStakingManager.abi,
      functionName: 'erc20',
    })) as string | undefined;
    // Treat the zero address as "no ERC-20 token" — a native staking
    // manager can technically expose erc20() returning address(0); we don't
    // want to misclassify that as ERC-20 staking.
    if (token && token.toLowerCase() !== ZERO_ADDRESS) return 'pos-erc20';
    return 'pos-native';
  } catch {
    // erc20() not present on the contract → native staking manager.
    return 'pos-native';
  }
}
