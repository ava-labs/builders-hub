import { useContractActions } from '../useContractActions';
import FeeManagerAbi from '@/contracts/precompiles/FeeManager.json';
import RewardManagerAbi from '@/contracts/precompiles/RewardManager.json';
import NativeMinterAbi from '@/contracts/precompiles/NativeMinter.json';
import type { FeeConfig } from '../types';

export type { FeeConfig } from '../types';

// Fixed precompile addresses
const FEE_MANAGER_ADDRESS = '0x0200000000000000000000000000000000000003';
const REWARD_MANAGER_ADDRESS = '0x0200000000000000000000000000000000000004';
const NATIVE_MINTER_ADDRESS = '0x0200000000000000000000000000000000000001';

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
  const feeManagerContract = useContractActions(FEE_MANAGER_ADDRESS, FeeManagerAbi.abi);
  const rewardManagerContract = useContractActions(REWARD_MANAGER_ADDRESS, RewardManagerAbi.abi);
  const nativeMinterContract = useContractActions(NATIVE_MINTER_ADDRESS, NativeMinterAbi.abi);

  const isReady = feeManagerContract.isReady && rewardManagerContract.isReady && nativeMinterContract.isReady;

  return {
    feeManager: {
      setFeeConfig: (config: FeeConfig) =>
        feeManagerContract.write('setFeeConfig', [
          config.gasLimit,
          config.targetBlockRate,
          config.minBaseFee,
          config.targetGas,
          config.baseFeeChangeDenominator,
          config.minBlockGasCost,
          config.maxBlockGasCost,
          config.blockGasCostStep,
        ], 'Set Fee Config'),
      getFeeConfig: () => feeManagerContract.read('getFeeConfig') as Promise<FeeConfig>,
      getFeeConfigLastChangedAt: () => feeManagerContract.read('getFeeConfigLastChangedAt') as Promise<bigint>,
    },

    rewardManager: {
      allowFeeRecipients: () =>
        rewardManagerContract.write('allowFeeRecipients', [], 'Allow Fee Recipients'),
      areFeeRecipientsAllowed: () =>
        rewardManagerContract.read('areFeeRecipientsAllowed') as Promise<boolean>,
      disableRewards: () =>
        rewardManagerContract.write('disableRewards', [], 'Disable Rewards'),
      currentRewardAddress: () =>
        rewardManagerContract.read('currentRewardAddress') as Promise<string>,
      setRewardAddress: (address) =>
        rewardManagerContract.write('setRewardAddress', [address], 'Set Reward Address'),
    },

    nativeMinter: {
      mintNativeCoin: (to, amount) =>
        nativeMinterContract.write('mintNativeCoin', [to, amount], 'Mint Native Coin'),
      readAllowList: (address) =>
        nativeMinterContract.read('readAllowList', [address]) as Promise<number>,
      setAdmin: (address) =>
        nativeMinterContract.write('setAdmin', [address], 'Set Native Minter Admin'),
      setEnabled: (address) =>
        nativeMinterContract.write('setEnabled', [address], 'Set Native Minter Enabled'),
      setManager: (address) =>
        nativeMinterContract.write('setManager', [address], 'Set Native Minter Manager'),
      setNone: (address) =>
        nativeMinterContract.write('setNone', [address], 'Set Native Minter None'),
    },

    isReady,
  };
}
