"use client";

import { useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useL1List, type L1ListItem } from '@/components/toolbox/stores/l1ListStore';
import { useTestnetFaucet, type FaucetClaimResult } from './useTestnetFaucet';
import { toast } from 'sonner';
import { balanceService } from '@/components/toolbox/services/balanceService';
import { useChainTokenTracker } from './useChainTokenTracker';
import confetti from 'canvas-confetti';

const P_CHAIN_THRESHOLDS = {
  threshold: 0.5,
  dripAmount: 0.5
};

export const useAutomatedFaucet = () => {
  const sessionResult = useSession();
  const session = sessionResult?.data;
  const { 
    walletEVMAddress, 
    pChainAddress, 
    isTestnet, 
    balances,
    isLoading,
    bootstrapped 
  } = useWalletStore();
  
  const l1List = useL1List();
  const { 
    claimEVMTokens, 
    claimPChainAVAX, 
    getChainsWithFaucet 
  } = useTestnetFaucet();
  
  const { 
    getNeededChains, 
    markChainAsNeeded,
    markChainAsSatisfied, 
    cleanupExpiredEntries 
  } = useChainTokenTracker();
  
  const processedSessionRef = useRef<string | null>(null);
  const lastAttemptRef = useRef<number>(0);
  const rateLimitedChainsRef = useRef<Set<number | string>>(new Set());
  const allTokensReceivedRef = useRef<boolean>(false);
  const COOLDOWN_PERIOD = 5 * 60 * 1000;
  
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

  // check if user has sufficient balance on all needed chains
  const checkAllTokensReceived = useCallback((): boolean => {
    if (!walletEVMAddress) return true;
    
    const neededChainIds = getNeededChains(walletEVMAddress);
    const chainsWithFaucet = getChainsWithFaucet();
    
    // Check only needed chains, not all chains with faucets
    const neededChains = chainsWithFaucet.filter(chain => neededChainIds.includes(chain.evmChainId));
    const hasAllNeededEVMTokens = neededChains.every(chain => checkSufficientBalance(chain.evmChainId));
    const hasPChainTokens = !pChainAddress || checkSufficientPChainBalance();   
    
    return hasAllNeededEVMTokens && hasPChainTokens;
  }, [getChainsWithFaucet, walletEVMAddress, pChainAddress, checkSufficientBalance, checkSufficientPChainBalance, getNeededChains]);
  
  // confetti fireworks for successful claim
  const triggerFireworks = useCallback(() => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  }, []);
  
  // confetti animation and success toast
  const showAutomatedDripSuccess = useCallback((results: FaucetClaimResult[], isPChain: boolean = false) => {
    const successfulClaims = results.filter(r => r.success);
    
    if (successfulClaims.length > 0) {
      // Trigger fireworks animation
      triggerFireworks();
      
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
    const now = Date.now();

    if (processedSessionRef.current === sessionKey) return;
    if (now - lastAttemptRef.current < COOLDOWN_PERIOD) return;
    if (allTokensReceivedRef.current) return;

    try {
      cleanupExpiredEntries();
      await balanceService.updateAllBalancesWithAllL1s(getChainsWithFaucet());
      await new Promise(resolve => setTimeout(resolve, 2000));
      const hasLoadedBalances = walletEVMAddress && (
        balances.cChain > 0 || 
        balances.pChain > 0 || 
        Object.values(balances.l1Chains).some(balance => balance > 0) ||
        (!isLoading.cChain && !isLoading.pChain)
      );

      if (!hasLoadedBalances) {
        return;
      }
    } catch (error) {
      return;
    }

    if (walletEVMAddress) {
      const neededChains = getNeededChains(walletEVMAddress);
      const chainsWithFaucet = getChainsWithFaucet();

      if (neededChains.length === 0) {
        for (const chain of chainsWithFaucet) {
          if (!checkSufficientBalance(chain.evmChainId)) {
            markChainAsNeeded(chain.evmChainId, walletEVMAddress);
          }
        }
      } else {
        for (const chain of chainsWithFaucet) {
          if (!neededChains.includes(chain.evmChainId) && !checkSufficientBalance(chain.evmChainId)) {
            markChainAsNeeded(chain.evmChainId, walletEVMAddress);
          }
        }
      }
    }

    if (checkAllTokensReceived()) {
      allTokensReceivedRef.current = true;
      processedSessionRef.current = sessionKey;
      return;
    }

    lastAttemptRef.current = now;
    
    try {
      const results: FaucetClaimResult[] = [];
      const chainsWithFaucet = getChainsWithFaucet();
      const neededChainIds = walletEVMAddress ? getNeededChains(walletEVMAddress) : [];    
      const evmClaimPromises = chainsWithFaucet
        .filter(chain => 
          walletEVMAddress && 
          neededChainIds.includes(chain.evmChainId) && // we only need to process chains marked as needed in local storage
          !checkSufficientBalance(chain.evmChainId) &&
          !rateLimitedChainsRef.current.has(chain.evmChainId)
        )
        .map(async (chain) => {
          try {
            const result = await retryOperation(
              () => claimEVMTokens(chain.evmChainId, true),
              2 // max only 2 retries 
            );
            return { ...result, chainId: chain.evmChainId };
          } catch (error) {
            // check for rate limit errors
            if (error instanceof Error && error.message.toLowerCase().includes('rate limit')) {
              rateLimitedChainsRef.current.add(chain.evmChainId);
            }
            return null;
          }
        });
      
      const evmResults = (await Promise.all(evmClaimPromises)).filter(Boolean) as FaucetClaimResult[];
      results.push(...evmResults);
      
      // Mark successful chains as satisfied
      if (walletEVMAddress) {
        evmResults.forEach(result => {
          if (result.success && result.chainId) {
            markChainAsSatisfied(result.chainId, walletEVMAddress);
          }
        });
      }
      
      if (pChainAddress && !checkSufficientPChainBalance() && !rateLimitedChainsRef.current.has('pchain')) {
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
          if (error instanceof Error && error.message.toLowerCase().includes('rate limit')) {
            rateLimitedChainsRef.current.add('pchain');
          }
          return null;
        }
      }
      
      if (evmResults.length > 0) {
        showAutomatedDripSuccess(evmResults, false);
      }

      if (checkAllTokensReceived()) {
        allTokensReceivedRef.current = true;
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
    checkAllTokensReceived,
    getNeededChains,
    markChainAsNeeded,
    markChainAsSatisfied,
    cleanupExpiredEntries,
    checkSufficientBalance,
    l1List,
    balances,
    isLoading,
    getChainsWithFaucet,
    claimEVMTokens,
    claimPChainAVAX,
    checkSufficientPChainBalance,
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
    lastAttemptRef.current = 0;
    rateLimitedChainsRef.current.clear();
    allTokensReceivedRef.current = false;
  }, [walletEVMAddress, pChainAddress]);
};
