import { useMemo } from 'react';
import { useWalletStore } from '../stores/walletStore';
import { useViemChainStore } from '../stores/toolboxStore';
import { useWrappedNativeToken as useWrappedNativeTokenAddress } from '../stores/l1ListStore';
import { http, createPublicClient, parseEther, formatEther } from 'viem';
import WrappedNativeToken from '@/contracts/icm-contracts/compiled/WrappedNativeToken.json';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';

export interface WrappedNativeTokenHook {
  // Contract state queries (read functions) - excluding balanceOf as it's handled by balanceService
  allowance: (owner: string, spender: string) => Promise<string>;
  totalSupply: () => Promise<string>;
  name: () => Promise<string>;
  symbol: () => Promise<string>;
  decimals: () => Promise<number>;
  
  // Contract interactions (write functions)
  approve: (spender: string, amount: string) => Promise<string>;
  transfer: (to: string, amount: string) => Promise<string>;
  transferFrom: (from: string, to: string, amount: string) => Promise<string>;
  deposit: (amount: string) => Promise<string>;
  withdraw: (amount: string) => Promise<string>;
  
  // Contract address and metadata
  contractAddress: string | null;
  isReady: boolean;
  publicClient: any;
}

/**
 * Custom hook that provides typed access to all WrappedNativeToken contract functions
 * Automatically handles contract address resolution, chain configuration, and notifications
 */
export function useWrappedNativeToken(): WrappedNativeTokenHook {
  const { coreWalletClient, walletEVMAddress } = useWalletStore();
  const viemChain = useViemChainStore();
  const contractAddress = useWrappedNativeTokenAddress();
  const { notify } = useConsoleNotifications();

  // Create public client for read operations
  const publicClient = useMemo(() => {
    if (!viemChain) return null;
    
    return createPublicClient({
      transport: http(viemChain.rpcUrls.default.http[0] || "")
    });
  }, [viemChain]);

  const isReady = Boolean(contractAddress && publicClient && viemChain);

  // Read functions (view/pure) - balanceOf is handled by balanceService.fetchERC20Balance

  const allowance = async (owner: string, spender: string): Promise<string> => {
    if (!publicClient || !contractAddress) throw new Error('Contract not ready');
    
    const allowanceAmount = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: WrappedNativeToken.abi,
      functionName: 'allowance',
      args: [owner, spender]
    });
    
    return formatEther(allowanceAmount as bigint);
  };

  const totalSupply = async (): Promise<string> => {
    if (!publicClient || !contractAddress) throw new Error('Contract not ready');
    
    const supply = await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: WrappedNativeToken.abi,
      functionName: 'totalSupply'
    });
    
    return formatEther(supply as bigint);
  };

  const name = async (): Promise<string> => {
    if (!publicClient || !contractAddress) throw new Error('Contract not ready');
    
    return await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: WrappedNativeToken.abi,
      functionName: 'name'
    }) as string;
  };

  const symbol = async (): Promise<string> => {
    if (!publicClient || !contractAddress) throw new Error('Contract not ready');
    
    return await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: WrappedNativeToken.abi,
      functionName: 'symbol'
    }) as string;
  };

  const decimals = async (): Promise<number> => {
    if (!publicClient || !contractAddress) throw new Error('Contract not ready');
    
    return await publicClient.readContract({
      address: contractAddress as `0x${string}`,
      abi: WrappedNativeToken.abi,
      functionName: 'decimals'
    }) as number;
  };

  // Write functions (payable/nonpayable)
  const approve = async (spender: string, amount: string): Promise<string> => {
    if (!coreWalletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = coreWalletClient.writeContract({
      address: contractAddress as `0x${string}`,
      abi: WrappedNativeToken.abi,
      functionName: 'approve',
      args: [spender, parseEther(amount)],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`
    });

    notify({
      type: 'call',
      name: 'Approve Wrapped Native Token'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const transfer = async (to: string, amount: string): Promise<string> => {
    if (!coreWalletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = coreWalletClient.writeContract({
      address: contractAddress as `0x${string}`,
      abi: WrappedNativeToken.abi,
      functionName: 'transfer',
      args: [to, parseEther(amount)],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`
    });

    notify({
      type: 'call',
      name: 'Transfer Wrapped Native Token'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const transferFrom = async (from: string, to: string, amount: string): Promise<string> => {
    if (!coreWalletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = coreWalletClient.writeContract({
      address: contractAddress as `0x${string}`,
      abi: WrappedNativeToken.abi,
      functionName: 'transferFrom',
      args: [from, to, parseEther(amount)],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`
    });

    notify({
      type: 'call',
      name: 'Transfer From Wrapped Native Token'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const deposit = async (amount: string): Promise<string> => {
    if (!coreWalletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = coreWalletClient.writeContract({
      address: contractAddress as `0x${string}`,
      abi: WrappedNativeToken.abi,
      functionName: 'deposit',
      value: parseEther(amount),
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`
    });

    notify({
      type: 'call',
      name: 'Wrap Native Token'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const withdraw = async (amount: string): Promise<string> => {
    if (!coreWalletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = coreWalletClient.writeContract({
      address: contractAddress as `0x${string}`,
      abi: WrappedNativeToken.abi,
      functionName: 'withdraw',
      args: [parseEther(amount)],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`
    });

    notify({
      type: 'call',
      name: 'Unwrap Native Token'
    }, writePromise, viemChain);

    return await writePromise;
  };

  return {
    // Read functions (balanceOf excluded - use balanceService.fetchERC20Balance instead)
    allowance,
    totalSupply,
    name,
    symbol,
    decimals,
    
    // Write functions
    approve,
    transfer,
    transferFrom,
    deposit,
    withdraw,
    
    // Metadata
    contractAddress,
    isReady,
    publicClient
  };
}
