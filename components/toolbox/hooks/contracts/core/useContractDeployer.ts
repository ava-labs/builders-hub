import { useState } from 'react';
import { makePublicClientForChain } from '../../usePublicClientForChain';
import { useWalletStore } from '../../../stores/walletStore';
import { useViemChainStore } from '../../../stores/toolboxStore';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { useConnectedWallet } from '@/components/toolbox/contexts/ConnectedWalletContext';

export interface DeployParams {
  abi: any;
  bytecode: string;
  args: any[];
  name: string; // For notification
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
      const deployPromise = walletClient.deployContract({
        abi: params.abi,
        bytecode: params.bytecode as `0x${string}`,
        args: params.args,
        account: walletEVMAddress as `0x${string}`,
        chain: viemChain,
      });

      notify(
        {
          type: 'deploy',
          name: params.name,
        },
        deployPromise,
        viemChain,
      );

      const hash = await deployPromise;

      // Chain-specific public client for receipt polling. The global
      // publicClient from walletStore may point to the wrong RPC (e.g.
      // hardcoded to Fuji for non-Core wallets).
      const chainClient = makePublicClientForChain(viemChain.rpcUrls.default.http[0], [], viemChain);
      if (!chainClient) {
        throw new Error('Could not create chain-specific public client');
      }
      const receipt = await chainClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });

      if (!receipt.contractAddress) {
        throw new Error('No contract address in receipt');
      }

      return {
        hash,
        contractAddress: receipt.contractAddress,
        receipt,
      };
    } finally {
      setIsDeploying(false);
    }
  };

  return {
    deploy,
    isDeploying,
  };
}
