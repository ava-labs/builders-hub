import { create } from "zustand";
import { persist, combine } from "zustand/middleware";

const STORE_VERSION = "v1";

export type ICTTStep =
  | "select-token"
  | "deploy-home"
  | "deploy-remote"
  | "register"
  | "collateral";

export type TokenType = "erc20" | "native";

export interface ChainConfig {
  chainId: string;
  name: string;
  rpcUrl?: string;
  blockchainId?: string;
}

export interface ICTTSetupState {
  // Chain configuration
  homeChain: ChainConfig | null;
  remoteChain: ChainConfig | null;

  // Token configuration
  tokenType: TokenType;
  sourceTokenAddress: string;
  sourceTokenSymbol: string;
  sourceTokenDecimals: number;

  // Deployment addresses
  tokenHomeAddress: string;
  tokenRemoteAddress: string;

  // Registration & collateral
  isRegistered: boolean;
  isCollateralized: boolean;
  collateralAmount: string;

  // UI state
  currentStep: ICTTStep;
  expandedCodePanel: boolean;

  // Timestamps for tracking
  homeDeployedAt: number | null;
  remoteDeployedAt: number | null;
  registeredAt: number | null;
  collateralizedAt: number | null;
}

const initialState: ICTTSetupState = {
  homeChain: null,
  remoteChain: null,
  tokenType: "erc20",
  sourceTokenAddress: "",
  sourceTokenSymbol: "",
  sourceTokenDecimals: 18,
  tokenHomeAddress: "",
  tokenRemoteAddress: "",
  isRegistered: false,
  isCollateralized: false,
  collateralAmount: "0",
  currentStep: "select-token",
  expandedCodePanel: true,
  homeDeployedAt: null,
  remoteDeployedAt: null,
  registeredAt: null,
  collateralizedAt: null,
};

// Network-aware store cache
const storeCache: {
  testnet?: ReturnType<typeof createStore>;
  mainnet?: ReturnType<typeof createStore>;
} = {};

const createStore = (isTestnet: boolean) =>
  create(
    persist(
      combine(initialState, (set, get) => ({
        // Chain setters
        setHomeChain: (chain: ChainConfig | null) => set({ homeChain: chain }),
        setRemoteChain: (chain: ChainConfig | null) => set({ remoteChain: chain }),

        // Token setters
        setTokenType: (type: TokenType) => set({ tokenType: type }),
        setSourceToken: (address: string, symbol: string, decimals: number) =>
          set({ sourceTokenAddress: address, sourceTokenSymbol: symbol, sourceTokenDecimals: decimals }),

        // Deployment setters
        setTokenHomeAddress: (address: string) =>
          set({ tokenHomeAddress: address, homeDeployedAt: address ? Date.now() : null }),
        setTokenRemoteAddress: (address: string) =>
          set({ tokenRemoteAddress: address, remoteDeployedAt: address ? Date.now() : null }),

        // Registration & collateral
        setRegistered: (registered: boolean) =>
          set({ isRegistered: registered, registeredAt: registered ? Date.now() : null }),
        setCollateralized: (collateralized: boolean, amount?: string) =>
          set({
            isCollateralized: collateralized,
            collateralizedAt: collateralized ? Date.now() : null,
            collateralAmount: amount || get().collateralAmount,
          }),

        // UI state
        setCurrentStep: (step: ICTTStep) => set({ currentStep: step }),
        toggleCodePanel: () => set({ expandedCodePanel: !get().expandedCodePanel }),

        // Computed helpers
        getProgress: () => {
          const state = get();
          return {
            selectToken: !!state.sourceTokenAddress,
            deployHome: !!state.tokenHomeAddress,
            deployRemote: !!state.tokenRemoteAddress,
            register: state.isRegistered,
            collateral: state.isCollateralized,
          };
        },

        getCompletedSteps: () => {
          const state = get();
          const steps: ICTTStep[] = [];
          if (state.sourceTokenAddress) steps.push("select-token");
          if (state.tokenHomeAddress) steps.push("deploy-home");
          if (state.tokenRemoteAddress) steps.push("deploy-remote");
          if (state.isRegistered) steps.push("register");
          if (state.isCollateralized) steps.push("collateral");
          return steps;
        },

        // Reset
        reset: () => set(initialState),

        // Reset keeping chain config
        resetKeepingChains: () => {
          const { homeChain, remoteChain } = get();
          set({ ...initialState, homeChain, remoteChain });
        },
      })),
      {
        name: `${STORE_VERSION}-ictt-setup-${isTestnet ? "testnet" : "mainnet"}`,
      }
    )
  );

export function useICTTSetupStore(isTestnet: boolean = true) {
  const key = isTestnet ? "testnet" : "mainnet";

  if (!storeCache[key]) {
    storeCache[key] = createStore(isTestnet);
  }

  return storeCache[key]!;
}

// Step metadata for UI
export const ICTT_STEPS: Record<ICTTStep, {
  title: string;
  description: string;
  chainContext: "home" | "remote" | "any";
}> = {
  "select-token": {
    title: "Select Token",
    description: "Choose the token you want to bridge",
    chainContext: "home",
  },
  "deploy-home": {
    title: "Deploy Token Home",
    description: "Deploy the home contract on the source chain",
    chainContext: "home",
  },
  "deploy-remote": {
    title: "Deploy Token Remote",
    description: "Deploy the remote contract on the destination chain",
    chainContext: "remote",
  },
  "register": {
    title: "Register Remote",
    description: "Link the remote contract to the home",
    chainContext: "remote",
  },
  "collateral": {
    title: "Add Collateral",
    description: "Deposit initial collateral to enable transfers",
    chainContext: "home",
  },
};
