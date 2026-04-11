import { createFlowStore } from './createFlowStore';
import { STORE_VERSION } from './utils';

export interface SerializedValidator {
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

interface AddValidatorState {
  subnetIdL1: string;
  validators: SerializedValidator[];
  evmTxHash: string;
  validatorBalance: string;
  blsProofOfPossession: string;
  pChainTxId: string;
  globalError: string | null;
  globalSuccess: string | null;

  setSubnetIdL1: (subnetIdL1: string) => void;
  setValidators: (validators: SerializedValidator[]) => void;
  setEvmTxHash: (evmTxHash: string) => void;
  setValidatorBalance: (validatorBalance: string) => void;
  setBlsProofOfPossession: (blsProofOfPossession: string) => void;
  setPChainTxId: (pChainTxId: string) => void;
  setGlobalError: (globalError: string | null) => void;
  setGlobalSuccess: (globalSuccess: string | null) => void;
  reset: () => void;
}

const initialValues = {
  subnetIdL1: '',
  validators: [] as SerializedValidator[],
  evmTxHash: '',
  validatorBalance: '',
  blsProofOfPossession: '',
  pChainTxId: '',
  globalError: null as string | null,
  globalSuccess: null as string | null,
};

const { getStore: getAddValidatorStore, useStore: useAddValidatorStore } = createFlowStore<AddValidatorState>({
  name: 'add-validator-store',
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
        globalError: null,
        globalSuccess: null,
      }),

    setValidators: (validators: SerializedValidator[]) =>
      set({
        validators,
        evmTxHash: '',
        validatorBalance: '',
        blsProofOfPossession: '',
        pChainTxId: '',
        globalError: null,
        globalSuccess: null,
      }),

    setEvmTxHash: (evmTxHash: string) => set({ evmTxHash, pChainTxId: '', globalError: null, globalSuccess: null }),

    setValidatorBalance: (validatorBalance: string) => set({ validatorBalance }),
    setBlsProofOfPossession: (blsProofOfPossession: string) => set({ blsProofOfPossession }),

    setPChainTxId: (pChainTxId: string) => set({ pChainTxId, globalError: null, globalSuccess: null }),

    setGlobalError: (globalError: string | null) => set({ globalError }),
    setGlobalSuccess: (globalSuccess: string | null) => set({ globalSuccess }),

    reset: () => {
      set({ ...initialValues });
      window?.localStorage.removeItem(`${STORE_VERSION}-add-validator-store-${isTestnet ? 'testnet' : 'mainnet'}`);
    },
  }),
  partialize: (state) => {
    const { globalError, globalSuccess, ...rest } = state;
    return rest;
  },
});

export { getAddValidatorStore, useAddValidatorStore };

// ---- BigInt serialization helpers ----
// Centralises the conversion between SerializedValidator (string weights, stored)
// and ConvertToL1Validator (BigInt weights, used at runtime).

import type { ConvertToL1Validator } from '@/components/toolbox/components/ValidatorListInput';

export function deserializeValidators(serialized: SerializedValidator[]): ConvertToL1Validator[] {
  return serialized.map((v) => ({
    ...v,
    validatorWeight: BigInt(v.validatorWeight),
    validatorBalance: BigInt(v.validatorBalance),
  }));
}

export function serializeValidators(validators: ConvertToL1Validator[]): SerializedValidator[] {
  return validators.map((v) => ({
    ...v,
    validatorWeight: v.validatorWeight.toString(),
    validatorBalance: v.validatorBalance.toString(),
  }));
}
