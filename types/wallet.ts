export interface AddChainOptions {
    rpcUrl?: string;
    coinName?: string;
    chainName?: string;
    allowLookup?: boolean;
    /**
     * Authoritative testnet/mainnet flag from the caller. When set, the
     * AddChainModal uses this instead of Glacier's response for the
     * `isTestnet` field on the resulting L1ListItem. Quick L1 sets this
     * because it knows which network it deployed to; Glacier may not yet
     * have the chain indexed.
     */
    isTestnet?: boolean;
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
    validatorManagerBlockchainId?: string;
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
