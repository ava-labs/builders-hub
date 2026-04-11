import { useWalletStore } from '../../stores/walletStore';
import { useViemChainStore } from '../../stores/toolboxStore';
import { readContract } from 'viem/actions';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { useResolvedWalletClient } from '../useResolvedWalletClient';
import { useChainPublicClient } from '../useChainPublicClient';
import { parseContractError } from './parseContractError';
import type { Abi, AccessList } from 'viem';

export interface WriteOptions {
  /** Override default gas limit (default: 1_000_000n) */
  gas?: bigint;
  /** Native token value to send with the transaction */
  value?: bigint;
  /** EIP-2930 access list (used for warp message precompile) */
  accessList?: AccessList;
}

export interface ContractActions {
  /** Read a view/pure function from the contract */
  read: (functionName: string, args?: readonly unknown[]) => Promise<unknown>;

  /** Write to the contract — automatically notifies, parses errors */
  write: (
    functionName: string,
    args: readonly unknown[],
    notificationName: string,
    options?: WriteOptions,
  ) => Promise<string>;

  /** True when wallet + contract address + chain are all available (can write) */
  isReady: boolean;

  /** True when public client + contract address are available (can read) */
  isReadReady: boolean;

  /** The contract address passed to the hook */
  contractAddress: string | null;
}

/**
 * Generic hook that provides `read()` and `write()` functions for any contract.
 *
 * Centralises wallet client resolution, public client for reads, notification
 * toasts, error parsing, gas configuration, and ready-state tracking.
 *
 * Phase 2 will migrate individual hooks to use this as their base.
 */
export function useContractActions(contractAddress: string | null, abi: Abi | readonly unknown[]): ContractActions {
  const { walletEVMAddress } = useWalletStore();
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();
  const walletClient = useResolvedWalletClient();
  const publicClient = useChainPublicClient();

  const isReady = Boolean(contractAddress && walletClient && viemChain);
  const isReadReady = Boolean(contractAddress && publicClient);

  const read = async (functionName: string, args: readonly unknown[] = []): Promise<unknown> => {
    if (!publicClient || !contractAddress) throw new Error('Contract not ready for reads');
    return readContract(publicClient as any, {
      address: contractAddress as `0x${string}`,
      abi: abi as Abi,
      functionName,
      args,
    });
  };

  const write = async (
    functionName: string,
    args: readonly unknown[],
    notificationName: string,
    options: WriteOptions = {},
  ): Promise<string> => {
    if (!walletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const txConfig: any = {
      address: contractAddress as `0x${string}`,
      abi: abi as Abi,
      functionName,
      args,
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: options.gas ?? BigInt(1_000_000),
    };

    if (options.value !== undefined) txConfig.value = options.value;
    if (options.accessList) txConfig.accessList = options.accessList;

    const writePromise = walletClient.writeContract(txConfig);

    notify(
      {
        type: 'call',
        name: notificationName,
      },
      writePromise,
      viemChain,
    );

    try {
      return await writePromise;
    } catch (err) {
      throw new Error(parseContractError(err));
    }
  };

  return {
    read,
    write,
    isReady,
    isReadReady,
    contractAddress,
  };
}
