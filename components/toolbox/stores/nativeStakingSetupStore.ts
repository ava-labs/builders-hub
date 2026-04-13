import { createFlowStore } from './createFlowStore';
import { STORE_VERSION } from './utils';

interface NativeStakingSetupState {
  subnetIdL1: string;
  validatorMessagesLibAddress: string;
  stakingManagerAddress: string;
  rewardCalculatorAddress: string;
  initializeTxHash: string;
  globalError: string | null;
  globalSuccess: string | null;

  setSubnetIdL1: (subnetIdL1: string) => void;
  setValidatorMessagesLibAddress: (address: string) => void;
  setStakingManagerAddress: (address: string) => void;
  setRewardCalculatorAddress: (address: string) => void;
  setInitializeTxHash: (hash: string) => void;
  setGlobalError: (error: string | null) => void;
  setGlobalSuccess: (success: string | null) => void;
  reset: () => void;
}

const initialValues = {
  subnetIdL1: '',
  validatorMessagesLibAddress: '',
  stakingManagerAddress: '',
  rewardCalculatorAddress: '',
  initializeTxHash: '',
  globalError: null as string | null,
  globalSuccess: null as string | null,
};

const { getStore: getNativeStakingSetupStore, useStore: useNativeStakingSetupStore } = createFlowStore<NativeStakingSetupState>({
  name: 'native-staking-setup-store',
  storeCreator: (set, isTestnet) => ({
    ...initialValues,

    setSubnetIdL1: (subnetIdL1: string) => set({ subnetIdL1 }),
    setValidatorMessagesLibAddress: (address: string) => set({ validatorMessagesLibAddress: address }),
    setStakingManagerAddress: (address: string) => set({ stakingManagerAddress: address }),
    setRewardCalculatorAddress: (address: string) => set({ rewardCalculatorAddress: address }),
    setInitializeTxHash: (hash: string) => set({ initializeTxHash: hash }),
    setGlobalError: (error: string | null) => set({ globalError: error }),
    setGlobalSuccess: (success: string | null) => set({ globalSuccess: success }),

    reset: () => {
      set({ ...initialValues });
      window?.localStorage.removeItem(`${STORE_VERSION}-native-staking-setup-store-${isTestnet ? 'testnet' : 'mainnet'}`);
    },
  }),
  partialize: (state) => {
    const { globalError, globalSuccess, ...rest } = state;
    return rest;
  },
});

export { getNativeStakingSetupStore, useNativeStakingSetupStore };
