"use client";
import { useState, useCallback } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useL1List, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import useConsoleNotifications from './useConsoleNotifications';
import { balanceService } from '@/components/toolbox/services/balanceService';

export interface FaucetClaimResult {
  success: boolean;
  txHash?: string;
  txID?: string;
  message?: string;
  amount?: string;
  chainId?: number;
}

export const useTestnetFaucet = () => {
  const { walletEVMAddress, pChainAddress, isTestnet } = useWalletStore();
  const l1List = useL1List();
  const { notify } = useConsoleNotifications();
  
  const [isClaimingEVM, setIsClaimingEVM] = useState<Record<number, boolean>>({});
  const [isClaimingPChain, setIsClaimingPChain] = useState(false);

  const getChainsWithFaucet = useCallback((): L1ListItem[] => {
    return l1List.filter((chain: L1ListItem) => chain.hasBuilderHubFaucet);
  }, [l1List]);

  const claimEVMTokens = useCallback(async (chainId: number, silent: boolean = false): Promise<FaucetClaimResult> => {
    if (!walletEVMAddress) { throw new Error("Wallet address is required") }
    if (!isTestnet) { throw new Error("Faucet is only available on testnet") }

    const chainConfig = l1List.find((chain: L1ListItem) => chain.evmChainId === chainId && chain.hasBuilderHubFaucet);

    if (!chainConfig) { throw new Error(`Unsupported chain or faucet not available for chain ID ${chainId}`) }
    
    setIsClaimingEVM(prev => ({ ...prev, [chainId]: true }));

    try {
      const faucetRequest = async () => {
        const response = await fetch(`/api/evm-chain-faucet?address=${walletEVMAddress}&chainId=${chainId}`);
        const rawText = await response.text();
        
        let data;
        try {
          data = JSON.parse(rawText);
        } catch (parseError) {
          throw new Error(`Invalid response: ${rawText.substring(0, 100)}...`);
        }

        if (!response.ok) {
          if (response.status === 401) { throw new Error("Please login first") }
          if (response.status === 429) { throw new Error(data.message || "Rate limit exceeded. Please try again later.") }
          throw new Error(data.message || `Error ${response.status}: Failed to get tokens`);
        }

        if (!data.success) { throw new Error(data.message || "Failed to get tokens") }       
        return data;
      };

      const faucetPromise = faucetRequest();

      if (!silent) {
        notify(
          {
            type: "local",
            name: `${chainConfig.name} Faucet Claim`,
          },
          faucetPromise
        );
      }

      const result = await faucetPromise;
      
      if (result.success) {
        setTimeout(() => {
          if (chainId === 43113) {
            balanceService.updateCChainBalance();
          } else {
            balanceService.updateL1Balance(chainId.toString());
          }
        }, 2000);
      }    
      return result;
    } finally {
      setIsClaimingEVM(prev => ({ ...prev, [chainId]: false }));
    }
  }, [walletEVMAddress, isTestnet, l1List, notify]);

  const claimPChainAVAX = useCallback(async (silent: boolean = false): Promise<FaucetClaimResult> => {
    if (!pChainAddress) { throw new Error("P-Chain address is required") }
    if (!isTestnet) { throw new Error("Faucet is only available on testnet") }
    setIsClaimingPChain(true);

    try {
      const faucetRequest = async () => {
        const response = await fetch(`/api/pchain-faucet?address=${pChainAddress}`);
        const rawText = await response.text();

        let data;
        try {
          data = JSON.parse(rawText);
        } catch (parseError) {
          throw new Error(`Invalid response: ${rawText.substring(0, 100)}...`);
        }

        if (!response.ok) {
          if (response.status === 401) {throw new Error("Please login first") }
          if (response.status === 429) { throw new Error(data.message || "Rate limit exceeded. Please try again later.") }
          throw new Error(data.message || `Error ${response.status}: Failed to get tokens`);
        }

        if (!data.success) { throw new Error(data.message || "Failed to get tokens") }      
        return data;
      };

      const faucetPromise = faucetRequest();

      if (!silent) {
        notify(
          {
            type: "local",
            name: "P-Chain AVAX Faucet Claim",
          },
          faucetPromise
        );
      }

      const result = await faucetPromise;      
      if (result.success) { setTimeout(() => { balanceService.updatePChainBalance() }, 2000) }
      return result;
    } finally {
      setIsClaimingPChain(false);
    }
  }, [pChainAddress, isTestnet, notify]);

  return {
    claimEVMTokens,
    claimPChainAVAX,
    getChainsWithFaucet,
    isClaimingEVM,
    isClaimingPChain,
    canClaim: isTestnet && (walletEVMAddress || pChainAddress),
  };
};
