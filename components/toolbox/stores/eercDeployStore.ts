import { createFlowStore } from './createFlowStore';

export type EERCDeployMode = 'standalone' | 'converter';

interface EERCDeployState {
  mode: EERCDeployMode;
  /** Display name — ignored for converter mode (the contract rejects it). */
  name: string;
  symbol: string;
  /** eERC's internal decimals — protocol default is 2. */
  decimals: number;

  babyJubJubAddress: string;
  verifiers: {
    registration: string;
    mint: string;
    transfer: string;
    withdraw: string;
    burn: string;
  };
  registrarAddress: string;
  encryptedERCAddress: string;

  /** Latest tx hash per step, surfaced in the FlowCompletionModal. */
  lastTxHash: string;

  globalError: string | null;

  setMode: (m: EERCDeployMode) => void;
  setName: (n: string) => void;
  setSymbol: (s: string) => void;
  setDecimals: (d: number) => void;
  setBabyJubJubAddress: (a: string) => void;
  setVerifier: (kind: keyof EERCDeployState['verifiers'], addr: string) => void;
  setRegistrarAddress: (a: string) => void;
  setEncryptedERCAddress: (a: string) => void;
  setLastTxHash: (h: string) => void;
  setGlobalError: (e: string | null) => void;
  reset: () => void;
}

const initial = {
  mode: 'converter' as EERCDeployMode,
  name: '',
  symbol: '',
  decimals: 2,
  babyJubJubAddress: '',
  verifiers: {
    registration: '',
    mint: '',
    transfer: '',
    withdraw: '',
    burn: '',
  },
  registrarAddress: '',
  encryptedERCAddress: '',
  lastTxHash: '',
  globalError: null as string | null,
};

export const { getStore: getEERCDeployStore, useStore: useEERCDeployStore } = createFlowStore<EERCDeployState>({
  name: 'eerc-deploy-store',
  storeCreator: (set) => ({
    ...initial,
    setMode: (mode) => set({ mode }),
    setName: (name) => set({ name }),
    setSymbol: (symbol) => set({ symbol }),
    setDecimals: (decimals) => set({ decimals }),
    setBabyJubJubAddress: (babyJubJubAddress) => set({ babyJubJubAddress }),
    setVerifier: (kind, addr) => set((s) => ({ verifiers: { ...s.verifiers, [kind]: addr } })),
    setRegistrarAddress: (registrarAddress) => set({ registrarAddress }),
    setEncryptedERCAddress: (encryptedERCAddress) => set({ encryptedERCAddress }),
    setLastTxHash: (lastTxHash) => set({ lastTxHash }),
    setGlobalError: (globalError) => set({ globalError }),
    reset: () => set({ ...initial }),
  }),
});
