import { useWalletStore } from '../stores/walletStore';
import { useViemChainStore } from '../stores/toolboxStore';
import { useWrappedNativeToken as useWrappedNativeTokenAddress } from '../stores/l1ListStore';
import { parseEther } from 'viem';
import WrappedNativeToken from '@/contracts/icm-contracts/compiled/WrappedNativeToken.json';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { useERC20Token } from './useERC20Token';
import type { ERC20TokenHook } from './useERC20Token';
import { useWallet } from './useWallet';

export type WrappedNativeTokenHook = ERC20TokenHook & {
  deposit: (amount: string) => Promise<string>;
  withdraw: (amount: string) => Promise<string>;
};

export function useWrappedNativeToken(): WrappedNativeTokenHook {
  const { coreWalletClient, walletEVMAddress } = useWalletStore();
  const viemChain = useViemChainStore();
  const contractAddress = useWrappedNativeTokenAddress();
  const { notify } = useConsoleNotifications();
  const { avalancheWalletClient } = useWallet();

  // Use the generic ERC20 hook for standard ERC20 functions
  const erc20Token = useERC20Token(contractAddress, WrappedNativeToken.abi);

  const deposit = async (amount: string): Promise<string> => {
    if (!avalancheWalletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = avalancheWalletClient.writeContract({
      address: contractAddress as `0x${string}`,
      abi: WrappedNativeToken.abi,
      functionName: 'deposit',
      value: parseEther(amount),
      account: walletEVMAddress as `0x${string}`
    });

    notify({
      type: 'call',
      name: 'Wrap Native Token'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const withdraw = async (amount: string): Promise<string> => {
    if (!avalancheWalletClient || !contractAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = avalancheWalletClient.writeContract({
      address: contractAddress as `0x${string}`,
      abi: WrappedNativeToken.abi,
      functionName: 'withdraw',
      args: [parseEther(amount)],
      account: walletEVMAddress as `0x${string}`
    });

    notify({
      type: 'call',
      name: 'Unwrap Native Token'
    }, writePromise, viemChain);

    return await writePromise;
  };

  return {
    ...erc20Token,
    deposit,
    withdraw
  };
}
