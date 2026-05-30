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
    /**
     * Optional genesis JSON to seed the modal's "Genesis JSON (optional)"
     * textarea. Callers in the create-l1 flow pass this from
     * createChainStore so the resulting L1ListItem ends up with the
     * genesis on file — driving Copy Genesis on the My L1 dashboard
     * without requiring the user to re-paste a JSON they already
     * configured.
     */
    genesisData?: string;
    /**
     * Optional block explorer URL the caller wants persisted on the
     * resulting L1ListItem. Quick L1 passes `result.explorer.url` here so
     * the per-L1 Firn URL survives the wallet-add hop and becomes the
     * dashboard's default explorer — matching what the user just saw on
     * the deployment success screen.
     */
    explorerUrl?: string;
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
    /** Optional stringified genesis JSON. Carried through Add Chain so the
     *  Copy Genesis button on the L1 detail page can serve it. */
    genesisData?: string;
    /** Optional block explorer URL. Carried through Add Chain to seed
     *  L1ListItem.explorerUrl, which drives the default selection in the
     *  dashboard's <ExplorerMenu> via lib/explorers.ts Firn detection. */
    explorerUrl?: string;
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
