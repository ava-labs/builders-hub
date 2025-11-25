import { useMemo } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { useViemChainStore } from '../stores/toolboxStore';
import { parseEther, formatEther } from 'viem';
import { readContract } from 'viem/actions';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { useWallet } from './useWallet';

export interface ERC20TokenHook {
  allowance: (owner: string, spender: string) => Promise<string>;
  balanceOf: (account: string) => Promise<string>;
  totalSupply: () => Promise<string>;
  name: () => Promise<string>;
  symbol: () => Promise<string>;
  decimals: () => Promise<number>;
  approve: (spender: string, amount: string) => Promise<string>;
  transfer: (to: string, amount: string) => Promise<string>;
  transferFrom: (from: string, to: string, amount: string) => Promise<string>;
  contractAddress: string | null;
  isReady: boolean;
}

/**
 * Generic ERC20 token hook that provides typed access to all standard ERC20 functions
 * @param tokenAddress - The address of the ERC20 token contract
 * @param abi - The ABI of the ERC20 token contract
 */
export function useERC20Token(tokenAddress: string | null, abi: any): ERC20TokenHook {
  const { coreWalletClient, walletEVMAddress } = useWalletStore();
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();
  const { avalancheWalletClient } = useWallet();

  const isReady = Boolean(tokenAddress && avalancheWalletClient && viemChain);

  const allowance = async (owner: string, spender: string): Promise<string> => {
    if (!avalancheWalletClient || !tokenAddress) throw new Error('Contract not ready');
    
    const allowanceAmount = await readContract(avalancheWalletClient as any, {
      address: tokenAddress as `0x${string}`,
      abi: abi,
      functionName: 'allowance',
      args: [owner, spender]
    });
    
    return formatEther(allowanceAmount as bigint);
  };

  const balanceOf = async (account: string): Promise<string> => {
    if (!avalancheWalletClient || !tokenAddress) throw new Error('Contract not ready');
    
    const balance = await readContract(avalancheWalletClient as any, {
      address: tokenAddress as `0x${string}`,
      abi: abi,
      functionName: 'balanceOf',
      args: [account]
    });
    
    return formatEther(balance as bigint);
  };

  const totalSupply = async (): Promise<string> => {
    if (!avalancheWalletClient || !tokenAddress) throw new Error('Contract not ready');
    
    const supply = await readContract(avalancheWalletClient as any, {
      address: tokenAddress as `0x${string}`,
      abi: abi,
      functionName: 'totalSupply',
      args: []
    });
    
    return formatEther(supply as bigint);
  };

  const name = async (): Promise<string> => {
    if (!avalancheWalletClient || !tokenAddress) throw new Error('Contract not ready');
    
    return await readContract(avalancheWalletClient as any, {
      address: tokenAddress as `0x${string}`,
      abi: abi,
      functionName: 'name',
      args: []
    }) as string;
  };

  const symbol = async (): Promise<string> => {
    if (!avalancheWalletClient || !tokenAddress) throw new Error('Contract not ready');
    
    return await readContract(avalancheWalletClient as any, {
      address: tokenAddress as `0x${string}`,
      abi: abi,
      functionName: 'symbol',
      args: []
    }) as string;
  };

  const decimals = async (): Promise<number> => {
    if (!avalancheWalletClient || !tokenAddress) throw new Error('Contract not ready');
    
    return await readContract(avalancheWalletClient as any, {
      address: tokenAddress as `0x${string}`,
      abi: abi,
      functionName: 'decimals',
      args: []
    }) as number;
  };

  // Write functions (payable/nonpayable)
  const approve = async (spender: string, amount: string): Promise<string> => {
    if (!coreWalletClient || !tokenAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = coreWalletClient.writeContract({
      address: tokenAddress as `0x${string}`,
      abi: abi,
      functionName: 'approve',
      args: [spender, parseEther(amount)],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`
    });

    notify({
      type: 'call',
      name: 'Approve ERC20 Token'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const transfer = async (to: string, amount: string): Promise<string> => {
    if (!coreWalletClient || !tokenAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = coreWalletClient.writeContract({
      address: tokenAddress as `0x${string}`,
      abi: abi,
      functionName: 'transfer',
      args: [to, parseEther(amount)],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`
    });

    notify({
      type: 'call',
      name: 'Transfer ERC20 Token'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const transferFrom = async (from: string, to: string, amount: string): Promise<string> => {
    if (!coreWalletClient || !tokenAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = coreWalletClient.writeContract({
      address: tokenAddress as `0x${string}`,
      abi: abi,
      functionName: 'transferFrom',
      args: [from, to, parseEther(amount)],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`
    });

    notify({
      type: 'call',
      name: 'Transfer From ERC20 Token'
    }, writePromise, viemChain);

    return await writePromise;
  };

  return {
    // Read functions
    allowance,
    balanceOf,
    totalSupply,
    name,
    symbol,
    decimals,
    
    // Write functions
    approve,
    transfer,
    transferFrom,
    
    // Metadata
    contractAddress: tokenAddress,
    isReady
  };
}
