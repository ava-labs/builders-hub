import { createFlowStore } from './createFlowStore';
import { STORE_VERSION } from './utils';

export type TokenType = 'native' | 'erc20';

export interface SerializedStakeValidator {
  nodeID: string;
  nodePOP: {
    publicKey: string;
    proofOfPossession: string;
  };
  validatorWeight: string;
  validatorBalance: string;
  remainingBalanceOwner: {
    addresses: string[];
    threshold: number;
  };
  deactivationOwner: {
    addresses: string[];
    threshold: number;
  };
}

interface StakeValidatorState {
  subnetIdL1: string;
  tokenType: TokenType;
  validators: SerializedStakeValidator[];
  evmTxHash: string;
  validatorBalance: string;
  blsProofOfPossession: string;
  pChainTxId: string;
  validationID: string;
  globalError: string | null;
  globalSuccess: string | null;

  setSubnetIdL1: (subnetIdL1: string) => void;
  setTokenType: (tokenType: TokenType) => void;
  setValidators: (validators: SerializedStakeValidator[]) => void;
  setEvmTxHash: (evmTxHash: string) => void;
  setValidatorBalance: (validatorBalance: string) => void;
  setBlsProofOfPossession: (blsProofOfPossession: string) => void;
  setPChainTxId: (pChainTxId: string) => void;
  setValidationID: (validationID: string) => void;
  setGlobalError: (globalError: string | null) => void;
  setGlobalSuccess: (globalSuccess: string | null) => void;
  reset: () => void;
}

const initialValues = {
  subnetIdL1: '',
  tokenType: 'native' as TokenType,
  validators: [] as SerializedStakeValidator[],
  evmTxHash: '',
  validatorBalance: '',
  blsProofOfPossession: '',
  pChainTxId: '',
  validationID: '',
  globalError: null as string | null,
  globalSuccess: null as string | null,
};

const {
  getStore: getStakeValidatorStore,
  useStore: useStakeValidatorStore,
  useStoreApi: useStakeValidatorStoreApi,
} = createFlowStore<StakeValidatorState>({
  name: 'stake-validator-store',
  storeCreator: (set, isTestnet) => ({
    ...initialValues,

    setSubnetIdL1: (subnetIdL1: string) =>
      set({
        subnetIdL1,
        validators: [],
        evmTxHash: '',
        validatorBalance: '',
        blsProofOfPossession: '',
        pChainTxId: '',
        validationID: '',
        globalError: null,
        globalSuccess: null,
      }),

    setTokenType: (tokenType: TokenType) => set({ tokenType }),

    setValidators: (validators: SerializedStakeValidator[]) =>
      set({
        validators,
        evmTxHash: '',
        validatorBalance: '',
        blsProofOfPossession: '',
        pChainTxId: '',
        validationID: '',
        globalError: null,
        globalSuccess: null,
      }),

    setEvmTxHash: (evmTxHash: string) => set({ evmTxHash, pChainTxId: '', globalError: null, globalSuccess: null }),

    setValidatorBalance: (validatorBalance: string) => set({ validatorBalance }),
    setBlsProofOfPossession: (blsProofOfPossession: string) => set({ blsProofOfPossession }),

    setPChainTxId: (pChainTxId: string) => set({ pChainTxId, globalError: null, globalSuccess: null }),
    setValidationID: (validationID: string) => set({ validationID }),

    setGlobalError: (globalError: string | null) => set({ globalError }),
    setGlobalSuccess: (globalSuccess: string | null) => set({ globalSuccess }),

    reset: () => {
      set({ ...initialValues });
      window?.localStorage.removeItem(`${STORE_VERSION}-stake-validator-store-${isTestnet ? 'testnet' : 'mainnet'}`);
    },
  }),
  partialize: (state) => {
    const { globalError, globalSuccess, subnetIdL1: _, ...rest } = state;
    return rest;
  },
});

export { getStakeValidatorStore, useStakeValidatorStore, useStakeValidatorStoreApi };

// ---- BigInt serialization helpers ----

import type { ConvertToL1Validator } from '@/components/toolbox/components/ValidatorListInput';

export function deserializeStakeValidators(serialized: SerializedStakeValidator[]): ConvertToL1Validator[] {
  return serialized.map((v) => ({
    ...v,
    validatorWeight: BigInt(v.validatorWeight),
    validatorBalance: BigInt(v.validatorBalance),
  }));
}

export function serializeStakeValidators(validators: ConvertToL1Validator[]): SerializedStakeValidator[] {
  return validators.map((v) => ({
    ...v,
    validatorWeight: v.validatorWeight.toString(),
    validatorBalance: v.validatorBalance.toString(),
  }));
}
