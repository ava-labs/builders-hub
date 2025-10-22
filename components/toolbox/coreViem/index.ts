import { createAvalancheWalletClient } from '@avalanche-sdk/client'
import { avalanche, avalancheFuji } from '@avalanche-sdk/client/chains'
import type { AvalancheWalletClient } from '@avalanche-sdk/client'
import { addChain, CoreWalletAddChainParameters } from './overrides/addChain'
import { isTestnet } from './methods/isTestnet'
import { getPChainAddress } from './methods/getPChainAddress'
import { getCorethAddress } from './methods/getCorethAddress'
import { createSubnet, CreateSubnetParams } from './methods/createSubnet'
import { createChain, CreateChainParams } from './methods/createChain'
import { convertToL1, ConvertToL1Params } from './methods/convertToL1'
import { extractWarpMessageFromPChainTx, ExtractWarpMessageFromTxParams } from './methods/extractWarpMessageFromPChainTx'
import { getEthereumChain, GetEthereumChainResponse } from './methods/getEthereumChain'
import { extractChainInfo, ExtractChainInfoParams } from './methods/extractChainInfo'
import { getPChainBalance } from './methods/getPChainBalance'
import { registerL1Validator } from './methods/registerL1Validator'
import { RegisterL1ValidatorParams } from './methods/registerL1Validator'
import { setL1ValidatorWeight } from './methods/setL1ValidatorWeight'
import { SetL1ValidatorWeightParams } from './methods/setL1ValidatorWeight'
import { increaseL1ValidatorBalance, IncreaseL1ValidatorBalanceParams } from './methods/increaseL1ValidatorBalance'
import { extractL1ValidatorWeightMessage, ExtractL1ValidatorWeightMessageParams, ExtractL1ValidatorWeightMessageResponse } from './methods/extractL1ValidatorWeightMessage'
import { extractRegisterL1ValidatorMessage, ExtractRegisterL1ValidatorMessageParams, ExtractRegisterL1ValidatorMessageResponse } from './methods/extractRegisterL1ValidatorMessage'
import { ExtractWarpMessageFromTxResponse } from './methods/extractWarpMessageFromPChainTx'
import { ExtractChainInfoResponse } from './methods/extractChainInfo'

// Re-export custom Avalanche EVM RPC methods that should be called on publicClient
export { getActiveRulesAt } from './methods/getActiveRulesAt'
export type { GetActiveRulesAtResponse } from './methods/getActiveRulesAt'

// Type for the Avalanche wallet client with custom methods at root level
export type CoreWalletClientType = Omit<AvalancheWalletClient, 'addChain'> & {
    // Overridden methods at root level
    addChain: (args: CoreWalletAddChainParameters) => Promise<void>;
    // Custom methods at root level
    isTestnet: () => Promise<boolean>;
    getPChainAddress: () => Promise<string>;
    getCorethAddress: () => Promise<string>;
    createSubnet: (args: CreateSubnetParams) => Promise<string>;
    createChain: (args: CreateChainParams) => Promise<string>;
    convertToL1: (args: ConvertToL1Params) => Promise<string>;
    registerL1Validator: (args: RegisterL1ValidatorParams) => Promise<string>;
    setL1ValidatorWeight: (args: SetL1ValidatorWeightParams) => Promise<string>;
    increaseL1ValidatorBalance: (args: IncreaseL1ValidatorBalanceParams) => Promise<string>;
    extractWarpMessageFromPChainTx: (args: ExtractWarpMessageFromTxParams) => Promise<ExtractWarpMessageFromTxResponse>;
    extractL1ValidatorWeightMessage: (args: ExtractL1ValidatorWeightMessageParams) => Promise<ExtractL1ValidatorWeightMessageResponse>;
    extractRegisterL1ValidatorMessage: (args: ExtractRegisterL1ValidatorMessageParams) => Promise<ExtractRegisterL1ValidatorMessageResponse>;
    getEthereumChain: () => Promise<GetEthereumChainResponse>;
    extractChainInfo: (args: ExtractChainInfoParams) => Promise<ExtractChainInfoResponse>;
    getPChainBalance: () => Promise<bigint>;
};

export async function createCoreWalletClient(_account: `0x${string}`): Promise<CoreWalletClientType | null> {
    // Check if we're in a browser environment
    const isClient = typeof window !== 'undefined'

    // Only create a wallet client if we're in a browser
    if (!isClient) {
        return null; // Return null for SSR
    }

    // Check if window.avalanche exists and is an object
    if (!window.avalanche || typeof window.avalanche !== 'object') {
        return null; // Return null if Core wallet is not found
    }

    // Get the Ethereum chain info to determine if we're on a testnet
    const chain = await window.avalanche.request<GetEthereumChainResponse>({
        method: 'wallet_getEthereumChain',
    });

    // Create the Avalanche SDK wallet client
    const baseClient = createAvalancheWalletClient({
        chain: chain.isTestnet ? avalancheFuji : avalanche,
        transport: {
            type: 'custom',
            provider: window.avalanche,
        },
        account: _account
    });

    // Add all custom methods at root level
    const clientWithCustomMethods = {
        ...baseClient,
        // Overridden methods at root level
        addChain: (args: CoreWalletAddChainParameters) => addChain(baseClient, args),
        // Custom methods at root level
        isTestnet: () => isTestnet(baseClient),
        getPChainAddress: () => getPChainAddress(baseClient),
        getCorethAddress: () => getCorethAddress(baseClient),
        createSubnet: (args: CreateSubnetParams) => createSubnet(baseClient, args),
        createChain: (args: CreateChainParams) => createChain(baseClient, args),
        convertToL1: (args: ConvertToL1Params) => convertToL1(baseClient, args),
        registerL1Validator: (args: RegisterL1ValidatorParams) => registerL1Validator(baseClient, args),
        setL1ValidatorWeight: (args: SetL1ValidatorWeightParams) => setL1ValidatorWeight(baseClient, args),
        increaseL1ValidatorBalance: (args: IncreaseL1ValidatorBalanceParams) => increaseL1ValidatorBalance(baseClient, args),
        extractWarpMessageFromPChainTx: (args: ExtractWarpMessageFromTxParams) => extractWarpMessageFromPChainTx(baseClient, args),
        extractL1ValidatorWeightMessage: (args: ExtractL1ValidatorWeightMessageParams) => extractL1ValidatorWeightMessage(baseClient, args),
        extractRegisterL1ValidatorMessage: (args: ExtractRegisterL1ValidatorMessageParams) => extractRegisterL1ValidatorMessage(baseClient, args),
        getEthereumChain: () => getEthereumChain(baseClient),
        extractChainInfo: (args: ExtractChainInfoParams) => extractChainInfo(baseClient, args),
        getPChainBalance: () => getPChainBalance(baseClient),
    } as CoreWalletClientType;

    return clientWithCustomMethods;
}
