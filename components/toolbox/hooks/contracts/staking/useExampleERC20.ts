import { useERC20Token, ERC20TokenHook } from '../../useERC20Token';
import { useWalletStore } from '../../../stores/walletStore';
import { useViemChainStore } from '../../../stores/toolboxStore';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { useWalletClient } from 'wagmi';
import ExampleERC20Abi from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { parseEther } from 'viem';

/**
 * Extended ERC20 hook that includes mintable and burnable functionality
 * Uses composition pattern - extends useERC20Token like useWrappedNativeToken
 */
export type ExampleERC20Hook = ERC20TokenHook & {
  // Additional mint/burn functions
  mint: (to: string, amount: string) => Promise<string>;
  burn: (amount: string) => Promise<string>;
  burnFrom: (from: string, amount: string) => Promise<string>;

  // Access control functions
  grantRole: (role: string, account: string) => Promise<string>;
};

/**
 * Hook for interacting with ExampleERC20 contracts (mintable and burnable ERC20)
 * @param tokenAddress - The address of the ExampleERC20 contract
 */
export function useExampleERC20(tokenAddress: string | null): ExampleERC20Hook {
  // Get base ERC20 functionality
  const erc20Token = useERC20Token(tokenAddress, ExampleERC20Abi.abi);

  // Get additional dependencies for write functions
  const { walletEVMAddress } = useWalletStore();
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();
  const { data: walletClient } = useWalletClient();

  // Additional write functions
  const mint = async (to: string, amount: string): Promise<string> => {
    if (!walletClient || !tokenAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: tokenAddress as `0x${string}`,
      abi: ExampleERC20Abi.abi,
      functionName: 'mint',
      args: [to, parseEther(amount)],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Mint ExampleERC20 Token'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const burn = async (amount: string): Promise<string> => {
    if (!walletClient || !tokenAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: tokenAddress as `0x${string}`,
      abi: ExampleERC20Abi.abi,
      functionName: 'burn',
      args: [parseEther(amount)],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Burn ExampleERC20 Token'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const burnFrom = async (from: string, amount: string): Promise<string> => {
    if (!walletClient || !tokenAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: tokenAddress as `0x${string}`,
      abi: ExampleERC20Abi.abi,
      functionName: 'burnFrom',
      args: [from, parseEther(amount)],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Burn From ExampleERC20 Token'
    }, writePromise, viemChain);

    return await writePromise;
  };

  const grantRole = async (role: string, account: string): Promise<string> => {
    if (!walletClient || !tokenAddress || !walletEVMAddress || !viemChain) {
      throw new Error('Wallet not connected or contract not ready');
    }

    const writePromise = walletClient!.writeContract({
      address: tokenAddress as `0x${string}`,
      abi: ExampleERC20Abi.abi,
      functionName: 'grantRole',
      args: [role as `0x${string}`, account as `0x${string}`],
      chain: viemChain,
      account: walletEVMAddress as `0x${string}`,
      gas: BigInt(1_000_000),
    });

    notify({
      type: 'call',
      name: 'Grant Role'
    }, writePromise, viemChain);

    return await writePromise;
  };

  // Return composition of base ERC20 and additional functions
  return {
    ...erc20Token,
    mint,
    burn,
    burnFrom,
    grantRole
  };
}
