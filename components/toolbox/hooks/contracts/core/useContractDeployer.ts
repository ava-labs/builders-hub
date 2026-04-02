import { useState } from 'react';
import { createPublicClient, http } from 'viem';
import { useWalletStore } from '../../../stores/walletStore';
import { useViemChainStore } from '../../../stores/toolboxStore';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { useConnectedWallet } from '@/components/toolbox/contexts/ConnectedWalletContext';
import { getLinkedBytecode } from '@/components/toolbox/utils/contract-deployment';

export interface DeployParams {
  abi: any;
  /** Bytecode as a hex string, or as a compiled bytecode object with linkReferences for library linking */
  bytecode: string | { object: string; linkReferences: Record<string, Record<string, any[]>> };
  args: any[];
  name: string; // For notification
  /** Address of the linked library (required when bytecode has linkReferences) */
  libraryAddress?: string;
}

export interface DeployResult {
  hash: string;
  contractAddress: string;
  receipt: any;
}

export interface ContractDeployerHook {
  deploy: (params: DeployParams) => Promise<DeployResult>;
  isDeploying: boolean;
}

/**
 * Hook for deploying contracts
 * Provides a simplified interface for contract deployment with automatic notifications
 */
export function useContractDeployer(): ContractDeployerHook {
  const { walletEVMAddress } = useWalletStore();
  const { walletClient } = useConnectedWallet();
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();
  const [isDeploying, setIsDeploying] = useState(false);

  const deploy = async (params: DeployParams): Promise<DeployResult> => {
    if (!walletClient || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or chain not configured');
    }

    setIsDeploying(true);
    try {
      // Resolve bytecode — link libraries if bytecode has linkReferences
      let resolvedBytecode: string;
      if (typeof params.bytecode === 'object' && params.bytecode.linkReferences) {
        if (!params.libraryAddress) {
          throw new Error('libraryAddress is required when bytecode has linkReferences');
        }
        resolvedBytecode = getLinkedBytecode(params.bytecode, params.libraryAddress);
      } else {
        resolvedBytecode = typeof params.bytecode === 'string' ? params.bytecode : params.bytecode.object;
      }

      const deployPromise = walletClient.deployContract({
        abi: params.abi,
        bytecode: resolvedBytecode as `0x${string}`,
        args: params.args,
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain
      });

      notify({
        type: 'deploy',
        name: params.name
      }, deployPromise, viemChain);

      const hash = await deployPromise;

      // Create a chain-specific public client for receipt polling.
      // The global publicClient from walletStore may point to the wrong RPC
      // (e.g. hardcoded to Fuji for non-Core wallets).
      const chainClient = createPublicClient({
        chain: viemChain,
        transport: http(viemChain.rpcUrls.default.http[0]),
      });
      const receipt = await chainClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });

      if (!receipt.contractAddress) {
        throw new Error('No contract address in receipt');
      }

      return {
        hash,
        contractAddress: receipt.contractAddress,
        receipt
      };
    } finally {
      setIsDeploying(false);
    }
  };

  return {
    deploy,
    isDeploying
  };
}
