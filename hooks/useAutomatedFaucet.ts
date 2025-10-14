"use client";

import { useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useL1List, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { useTestnetFaucet, type FaucetClaimResult } from './useTestnetFaucet';
import { toast } from 'sonner';
import { balanceService } from '@/components/toolbox/services/balanceService';

const P_CHAIN_THRESHOLDS = {
  threshold: 0.5, // defined here as we don't have it in the l1ListStore
};

export const useAutomatedFaucet = () => {
  const { data: session } = useSession();
  const { 
    walletEVMAddress, 
    pChainAddress, 
    isTestnet, 
    balances,
    bootstrapped 
  } = useWalletStore();
  
  const l1List = useL1List();
  const { 
    claimEVMTokens, 
    claimPChainAVAX, 
    getChainsWithFaucet 
  } = useTestnetFaucet();
  
  const processedSessionRef = useRef<string | null>(null);
  
  // check if user has sufficient balance for a given chain
  const checkSufficientBalance = useCallback((chainId: number): boolean => {
    const chain = l1List.find((c: L1ListItem) => c.evmChainId === chainId);
    if (!chain?.faucetThresholds) return true; // assuming sufficient balance if thresholds are not set 
    const balance = chainId === 43113 ? balances.cChain : (balances.l1Chains[chainId.toString()] || 0);  
    return balance >= chain.faucetThresholds.threshold;
  }, [l1List, balances.cChain, balances.l1Chains]);

  const checkSufficientPChainBalance = useCallback((): boolean => {
    return balances.pChain >= P_CHAIN_THRESHOLDS.threshold;
  }, [balances.pChain]);
  
  // confetti animation and success toast
  const showAutomatedDripSuccess = useCallback((results: FaucetClaimResult[], isPChain: boolean = false) => {
    const successfulClaims = results.filter(r => r.success);
    
    if (successfulClaims.length > 0) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('automated-faucet-success', {
          detail: { results: successfulClaims, isPChain }
        }));
      }
      
      const chainNames = isPChain ? ['P-Chain'] : successfulClaims.map(r => {
        const chain = l1List.find((c: L1ListItem) => c.evmChainId === r.chainId);
        return chain?.name || `Chain ${r.chainId}`;
      });
      
      toast.success(
        `🎉 Testnet tokens airdropped!`, 
        {
          description: `You received tokens on: ${chainNames.join(', ')}`,
          duration: 5000,
        }
      );
    }
  }, [l1List]);
  
  const processAutomatedClaims = useCallback(async () => {
    if (!session?.user?.id || !isTestnet || !bootstrapped) return;
    
    const sessionKey = `${session.user.id}-${walletEVMAddress}-${pChainAddress}`;

    if (processedSessionRef.current === sessionKey) return;
    
    try {
      await balanceService.updateAllBalancesWithAllL1s(getChainsWithFaucet());
      await new Promise(resolve => setTimeout(resolve, 1000)); 
      
      const results: FaucetClaimResult[] = [];
      const chainsWithFaucet = getChainsWithFaucet();
      const evmClaimPromises = chainsWithFaucet
        .filter(chain => walletEVMAddress && !checkSufficientBalance(chain.evmChainId))
        .map(async (chain) => {
          try {
            const result = await retryOperation(
              () => claimEVMTokens(chain.evmChainId, true),
              2 // max only 2 retries 
            );
            return { ...result, chainId: chain.evmChainId };
          } catch (error) {
            return null;
          }
        });
      
      const evmResults = (await Promise.all(evmClaimPromises)).filter(Boolean) as FaucetClaimResult[];
      results.push(...evmResults);
      
      if (pChainAddress && !checkSufficientPChainBalance()) {
        try {
          const result = await retryOperation(
            () => claimPChainAVAX(true),
            2 // max only 2 retries
          );
          results.push(result);

          if (result.success) {
            showAutomatedDripSuccess([result], true);
          }
        } catch (error) { 
          return null;
        }
      }
      
      if (evmResults.length > 0) {
        showAutomatedDripSuccess(evmResults, false);
      }

      processedSessionRef.current = sessionKey;     
    } catch (error) {
      return error;
     }
  }, [
    session?.user?.id,
    isTestnet,
    bootstrapped,
    walletEVMAddress,
    pChainAddress,
    getChainsWithFaucet,
    checkSufficientBalance,
    checkSufficientPChainBalance,
    claimEVMTokens,
    claimPChainAVAX,
    showAutomatedDripSuccess
  ]);
  
  const retryOperation = async <T>(
    operation: () => Promise<T>,
    maxRetries: number,
    delay: number = 1000
  ): Promise<T> => {
    let lastError: Error;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (i === maxRetries) break;

        // if RL exceeded, don't retry
        if (lastError.message.includes('Rate limit exceeded')) {
          throw lastError;
        }
        
        // exponential backoff to avoid excessive load with multiple retries
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
    
    throw lastError!;
  };
  
  useEffect(() => {
    const hasLogin = !!session?.user?.id;
    const hasWalletConnection = !!(walletEVMAddress || pChainAddress);
    
    if (hasLogin && hasWalletConnection && isTestnet && bootstrapped) {
      const timer = setTimeout(() => {
        processAutomatedClaims();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [
    session?.user?.id,
    walletEVMAddress,
    pChainAddress,
    isTestnet,
    bootstrapped,
    processAutomatedClaims
  ]);
  
  useEffect(() => {
    processedSessionRef.current = null;
  }, [walletEVMAddress, pChainAddress]);
};
