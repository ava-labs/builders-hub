export interface AddChainOptions {
    rpcUrl?: string;
    coinName?: string;
    chainName?: string;
    allowLookup?: boolean;
}

export interface ChainData {
    id: string;
    name: string;
    rpcUrl: string;
    evmChainId: number;
    coinName: string;
    isTestnet: boolean;
    subnetId: string;
    wrappedTokenAddress: string;
    validatorManagerAddress: string;
    logoUrl: string;
    wellKnownTeleporterRegistryAddress?: string;
}

export type AddChainResult = 
    | { success: true; chainData: ChainData }
    | { success: false };

export interface WalletModalState {
    isOpen: boolean;
    options: AddChainOptions | null;
    resolve: ((result: AddChainResult) => void) | null;
    reject: ((error: Error) => void) | null;
}
