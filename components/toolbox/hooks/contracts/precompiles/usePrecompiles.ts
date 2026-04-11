import { useWalletStore } from '../../../stores/walletStore';
import { useViemChainStore } from '../../../stores/toolboxStore';
import { readContract } from 'viem/actions';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { useWallet } from '../../useWallet';
import { useResolvedWalletClient } from '../../useResolvedWalletClient';
import FeeManagerAbi from '@/contracts/precompiles/FeeManager.json';
import RewardManagerAbi from '@/contracts/precompiles/RewardManager.json';
import NativeMinterAbi from '@/contracts/precompiles/NativeMinter.json';

// Fixed precompile addresses
const FEE_MANAGER_ADDRESS = '0x0200000000000000000000000000000000000003' as const;
const REWARD_MANAGER_ADDRESS = '0x0200000000000000000000000000000000000004' as const;
const NATIVE_MINTER_ADDRESS = '0x0200000000000000000000000000000000000001' as const;

export interface FeeConfig {
  gasLimit: bigint;
  targetBlockRate: bigint;
  minBaseFee: bigint;
  targetGas: bigint;
  baseFeeChangeDenominator: bigint;
  minBlockGasCost: bigint;
  maxBlockGasCost: bigint;
  blockGasCostStep: bigint;
}

export interface PrecompilesHook {
  // Fee Manager (0x0200000000000000000000000000000000000003)
  feeManager: {
    setFeeConfig: (config: FeeConfig) => Promise<string>;
    getFeeConfig: () => Promise<FeeConfig>;
    getFeeConfigLastChangedAt: () => Promise<bigint>;
  };

  // Reward Manager (0x0200000000000000000000000000000000000004)
  rewardManager: {
    allowFeeRecipients: () => Promise<string>;
    areFeeRecipientsAllowed: () => Promise<boolean>;
    disableRewards: () => Promise<string>;
    currentRewardAddress: () => Promise<string>;
    setRewardAddress: (address: string) => Promise<string>;
  };

  // Native Minter (0x0200000000000000000000000000000000000001)
  nativeMinter: {
    mintNativeCoin: (to: string, amount: bigint) => Promise<string>;
    readAllowList: (address: string) => Promise<number>;
    setAdmin: (address: string) => Promise<string>;
    setEnabled: (address: string) => Promise<string>;
    setManager: (address: string) => Promise<string>;
    setNone: (address: string) => Promise<string>;
  };

  isReady: boolean;
}

/**
 * Hook for interacting with all precompile contracts
 * No address parameter needed - addresses are fixed
 */
export function usePrecompiles(): PrecompilesHook {
  const { walletEVMAddress } = useWalletStore();
  const viemChain = useViemChainStore();
  const { notify } = useConsoleNotifications();
  const { avalancheWalletClient } = useWallet();
  const walletClient = useResolvedWalletClient();

  const isReady = Boolean(walletClient && viemChain);

  // Fee Manager functions
  const feeManager = {
    setFeeConfig: async (config: FeeConfig): Promise<string> => {
      if (!walletClient || !walletEVMAddress || !viemChain) {
        throw new Error('Wallet not connected');
      }

      const writePromise = walletClient!.writeContract({
        address: FEE_MANAGER_ADDRESS,
        abi: FeeManagerAbi.abi,
        functionName: 'setFeeConfig',
        args: [
          config.gasLimit,
          config.targetBlockRate,
          config.minBaseFee,
          config.targetGas,
          config.baseFeeChangeDenominator,
          config.minBlockGasCost,
          config.maxBlockGasCost,
          config.blockGasCostStep
        ],
        chain: viemChain,
        account: walletEVMAddress as `0x${string}`,
        gas: BigInt(1_000_000),
      });

      notify({
        type: 'call',
        name: 'Set Fee Config'
      }, writePromise, viemChain);

      return await writePromise;
    },

    getFeeConfig: async (): Promise<FeeConfig> => {
      if (!avalancheWalletClient) throw new Error('Client not ready');

      const result = await readContract(avalancheWalletClient as any, {
        address: FEE_MANAGER_ADDRESS,
        abi: FeeManagerAbi.abi,
        functionName: 'getFeeConfig',
        args: []
      });

      return result as FeeConfig;
    },

    getFeeConfigLastChangedAt: async (): Promise<bigint> => {
      if (!avalancheWalletClient) throw new Error('Client not ready');

      return await readContract(avalancheWalletClient as any, {
        address: FEE_MANAGER_ADDRESS,
        abi: FeeManagerAbi.abi,
        functionName: 'getFeeConfigLastChangedAt',
        args: []
      }) as bigint;
    }
  };

  // Reward Manager functions
  const rewardManager = {
    allowFeeRecipients: async (): Promise<string> => {
      if (!walletClient || !walletEVMAddress || !viemChain) {
        throw new Error('Wallet not connected');
      }

      const writePromise = walletClient!.writeContract({
        address: REWARD_MANAGER_ADDRESS,
        abi: RewardManagerAbi.abi,
        functionName: 'allowFeeRecipients',
        args: [],
        chain: viemChain,
        account: walletEVMAddress as `0x${string}`,
        gas: BigInt(1_000_000),
      });

      notify({
        type: 'call',
        name: 'Allow Fee Recipients'
      }, writePromise, viemChain);

      return await writePromise;
    },

    areFeeRecipientsAllowed: async (): Promise<boolean> => {
      if (!avalancheWalletClient) throw new Error('Client not ready');

      const result = await readContract(avalancheWalletClient as any, {
        address: REWARD_MANAGER_ADDRESS,
        abi: RewardManagerAbi.abi,
        functionName: 'areFeeRecipientsAllowed',
        args: []
      });

      return result as boolean;
    },

    disableRewards: async (): Promise<string> => {
      if (!walletClient || !walletEVMAddress || !viemChain) {
        throw new Error('Wallet not connected');
      }

      const writePromise = walletClient!.writeContract({
        address: REWARD_MANAGER_ADDRESS,
        abi: RewardManagerAbi.abi,
        functionName: 'disableRewards',
        args: [],
        chain: viemChain,
        account: walletEVMAddress as `0x${string}`,
        gas: BigInt(1_000_000),
      });

      notify({
        type: 'call',
        name: 'Disable Rewards'
      }, writePromise, viemChain);

      return await writePromise;
    },

    currentRewardAddress: async (): Promise<string> => {
      if (!avalancheWalletClient) throw new Error('Client not ready');

      return await readContract(avalancheWalletClient as any, {
        address: REWARD_MANAGER_ADDRESS,
        abi: RewardManagerAbi.abi,
        functionName: 'currentRewardAddress',
        args: []
      }) as string;
    },

    setRewardAddress: async (address: string): Promise<string> => {
      if (!walletClient || !walletEVMAddress || !viemChain) {
        throw new Error('Wallet not connected');
      }

      const writePromise = walletClient!.writeContract({
        address: REWARD_MANAGER_ADDRESS,
        abi: RewardManagerAbi.abi,
        functionName: 'setRewardAddress',
        args: [address],
        chain: viemChain,
        account: walletEVMAddress as `0x${string}`,
        gas: BigInt(1_000_000),
      });

      notify({
        type: 'call',
        name: 'Set Reward Address'
      }, writePromise, viemChain);

      return await writePromise;
    }
  };

  // Native Minter functions
  const nativeMinter = {
    mintNativeCoin: async (to: string, amount: bigint): Promise<string> => {
      if (!walletClient || !walletEVMAddress || !viemChain) {
        throw new Error('Wallet not connected');
      }

      const writePromise = walletClient!.writeContract({
        address: NATIVE_MINTER_ADDRESS,
        abi: NativeMinterAbi.abi,
        functionName: 'mintNativeCoin',
        args: [to, amount],
        chain: viemChain,
        account: walletEVMAddress as `0x${string}`,
        gas: BigInt(1_000_000),
      });

      notify({
        type: 'call',
        name: 'Mint Native Coin'
      }, writePromise, viemChain);

      return await writePromise;
    },

    readAllowList: async (address: string): Promise<number> => {
      if (!avalancheWalletClient) throw new Error('Client not ready');

      return await readContract(avalancheWalletClient as any, {
        address: NATIVE_MINTER_ADDRESS,
        abi: NativeMinterAbi.abi,
        functionName: 'readAllowList',
        args: [address]
      }) as number;
    },

    setAdmin: async (address: string): Promise<string> => {
      if (!walletClient || !walletEVMAddress || !viemChain) {
        throw new Error('Wallet not connected');
      }

      const writePromise = walletClient!.writeContract({
        address: NATIVE_MINTER_ADDRESS,
        abi: NativeMinterAbi.abi,
        functionName: 'setAdmin',
        args: [address],
        chain: viemChain,
        account: walletEVMAddress as `0x${string}`,
        gas: BigInt(1_000_000),
      });

      notify({
        type: 'call',
        name: 'Set Native Minter Admin'
      }, writePromise, viemChain);

      return await writePromise;
    },

    setEnabled: async (address: string): Promise<string> => {
      if (!walletClient || !walletEVMAddress || !viemChain) {
        throw new Error('Wallet not connected');
      }

      const writePromise = walletClient!.writeContract({
        address: NATIVE_MINTER_ADDRESS,
        abi: NativeMinterAbi.abi,
        functionName: 'setEnabled',
        args: [address],
        chain: viemChain,
        account: walletEVMAddress as `0x${string}`,
        gas: BigInt(1_000_000),
      });

      notify({
        type: 'call',
        name: 'Set Native Minter Enabled'
      }, writePromise, viemChain);

      return await writePromise;
    },

    setManager: async (address: string): Promise<string> => {
      if (!walletClient || !walletEVMAddress || !viemChain) {
        throw new Error('Wallet not connected');
      }

      const writePromise = walletClient!.writeContract({
        address: NATIVE_MINTER_ADDRESS,
        abi: NativeMinterAbi.abi,
        functionName: 'setManager',
        args: [address],
        chain: viemChain,
        account: walletEVMAddress as `0x${string}`,
        gas: BigInt(1_000_000),
      });

      notify({
        type: 'call',
        name: 'Set Native Minter Manager'
      }, writePromise, viemChain);

      return await writePromise;
    },

    setNone: async (address: string): Promise<string> => {
      if (!walletClient || !walletEVMAddress || !viemChain) {
        throw new Error('Wallet not connected');
      }

      const writePromise = walletClient!.writeContract({
        address: NATIVE_MINTER_ADDRESS,
        abi: NativeMinterAbi.abi,
        functionName: 'setNone',
        args: [address],
        chain: viemChain,
        account: walletEVMAddress as `0x${string}`,
        gas: BigInt(1_000_000),
      });

      notify({
        type: 'call',
        name: 'Set Native Minter None'
      }, writePromise, viemChain);

      return await writePromise;
    }
  };

  return {
    feeManager,
    rewardManager,
    nativeMinter,
    isReady
  };
}
