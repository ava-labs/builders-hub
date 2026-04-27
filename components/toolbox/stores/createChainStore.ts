import { createFlowStore } from './createFlowStore';
import { STORE_VERSION } from './utils';

const createChainInitialState = {
  subnetId: '',
  chainID: '',
  chainName: '',
  managerAddress: '0xfacade0000000000000000000000000000000000',
  genesisData: '',
  targetBlockRate: 1,
  gasLimit: 12000000,
  evmChainId: Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000,
  convertToL1TxId: '',
  validatorWeights: Array(100).fill(100) as number[],
  nodePopJsons: [''] as string[],
  blueprint: null as string | null,
};

type CreateChainState = typeof createChainInitialState & {
  setSubnetID: (subnetId: string) => void;
  setChainName: (chainName: string) => void;
  setChainID: (chainID: string) => void;
  setManagerAddress: (managerAddress: string) => void;
  setGenesisData: (genesisData: string) => void;
  setTargetBlockRate: (targetBlockRate: number) => void;
  setGasLimit: (gasLimit: number) => void;
  setEvmChainId: (evmChainId: number) => void;
  setConvertToL1TxId: (convertToL1TxId: string) => void;
  setValidatorWeights: (validatorWeights: number[]) => void;
  setNodePopJsons: (nodePopJsons: string[]) => void;
  setBlueprint: (blueprint: string | null) => void;
  reset: () => void;
};

const { getStore: getCreateChainStore, useStoreApi: useCreateChainStore } = createFlowStore<CreateChainState>({
  name: 'create-chain-store',
  storeCreator: (set, isTestnet) => ({
    ...createChainInitialState,
    setSubnetID: (subnetId: string) => set({ subnetId }),
    setChainName: (chainName: string) => set({ chainName }),
    setChainID: (chainID: string) => set({ chainID }),
    setManagerAddress: (managerAddress: string) => set({ managerAddress }),
    setGenesisData: (genesisData: string) => set({ genesisData }),
    setTargetBlockRate: (targetBlockRate: number) => set({ targetBlockRate }),
    setGasLimit: (gasLimit: number) => set({ gasLimit }),
    setEvmChainId: (evmChainId: number) => set({ evmChainId }),
    setConvertToL1TxId: (convertToL1TxId: string) => set({ convertToL1TxId }),
    setValidatorWeights: (validatorWeights: number[]) => set({ validatorWeights }),
    setNodePopJsons: (nodePopJsons: string[]) => set({ nodePopJsons }),
    setBlueprint: (blueprint: string | null) => set({ blueprint }),

    reset: () => {
      set({
        ...createChainInitialState,
        // Generate a fresh random EVM chain ID (the one in initialState is static per module load)
        evmChainId: Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000,
      });
      window?.localStorage.removeItem(`${STORE_VERSION}-create-chain-store-${isTestnet ? 'testnet' : 'mainnet'}`);
    },
  }),
});

export { getCreateChainStore, useCreateChainStore };
