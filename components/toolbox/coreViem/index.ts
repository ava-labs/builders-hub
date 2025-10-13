import { createWalletClient, custom, rpcSchema, DeployContractParameters, DeployContractReturnType, WriteContractReturnType, SendTransactionReturnType } from 'viem'
import { addChain, CoreWalletAddChainParameters } from './overrides/addChain'
import { CoreWalletRpcSchema } from './rpcSchema'
import { isTestnet } from './methods/isTestnet'
import { getPChainAddress } from './methods/getPChainAddress'
import { getCorethAddress } from './methods/getCorethAddress'
import { createSubnet, CreateSubnetParams } from './methods/createSubnet'
import { createChain, CreateChainParams } from './methods/createChain'
import { convertToL1, ConvertToL1Params } from './methods/convertToL1'
import { extractWarpMessageFromPChainTx, ExtractWarpMessageFromTxParams } from './methods/extractWarpMessageFromPChainTx'
import { getEthereumChain } from './methods/getEthereumChain'
import { extractChainInfo, ExtractChainInfoParams } from './methods/extractChainInfo'
import { getPChainBalance } from './methods/getPChainbalance'
import { sendTransaction } from './overrides/sendTransaction'
import { writeContract } from './overrides/writeContract'
//Warning! This api is not stable yet, it will change in the future
import { deployContract } from './overrides/deployContract'
import { registerL1Validator } from './methods/registerL1Validator'
import { RegisterL1ValidatorParams } from './methods/registerL1Validator'
import { setL1ValidatorWeight } from './methods/setL1ValidatorWeight'
import { SetL1ValidatorWeightParams } from './methods/setL1ValidatorWeight'
import { ExtractWarpMessageFromTxResponse } from './methods/extractWarpMessageFromPChainTx'
import { ExtractChainInfoResponse } from './methods/extractChainInfo'

// Extract the return type from CoreWalletRpcSchema for getEthereumChain
type GetEthereumChainResponse = Extract<CoreWalletRpcSchema[number], { Method: 'wallet_getEthereumChain' }>['ReturnType'];

// Type for the extended wallet client with all custom methods
export type CoreWalletClientType = ReturnType<typeof createWalletClient<any, any, any, CoreWalletRpcSchema>> & {
    addChain: (args: CoreWalletAddChainParameters) => Promise<void>;
    sendTransaction: (args: any) => Promise<SendTransactionReturnType>;
    writeContract: (args: any) => Promise<WriteContractReturnType>;
    deployContract: (args: DeployContractParameters) => Promise<DeployContractReturnType>;
    isTestnet: () => Promise<boolean>;
    getPChainAddress: () => Promise<string>;
    getCorethAddress: () => Promise<string>;
    createSubnet: (args: CreateSubnetParams) => Promise<string>;
    createChain: (args: CreateChainParams) => Promise<string>;
    convertToL1: (args: ConvertToL1Params) => Promise<string>;
    registerL1Validator: (args: RegisterL1ValidatorParams) => Promise<string>;
    setL1ValidatorWeight: (args: SetL1ValidatorWeightParams) => Promise<string>;
    extractWarpMessageFromPChainTx: (args: ExtractWarpMessageFromTxParams) => Promise<ExtractWarpMessageFromTxResponse>;
    getEthereumChain: () => Promise<GetEthereumChainResponse>;
    extractChainInfo: (args: ExtractChainInfoParams) => Promise<ExtractChainInfoResponse>;
    getPChainBalance: () => Promise<bigint>;
};

export function createCoreWalletClient(account: `0x${string}`): CoreWalletClientType | null {
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

    return createWalletClient({
        transport: custom(window.avalanche),
        account: account,
        rpcSchema: rpcSchema<CoreWalletRpcSchema>(),
    }).extend((client) => ({
        //override methods
        addChain: (args: CoreWalletAddChainParameters) => addChain(client, args),
        sendTransaction: (args) => sendTransaction(client, args),
        writeContract: (args) => writeContract(client, args),
        deployContract: (args: DeployContractParameters) => deployContract(client, args),
        //new methods
        isTestnet: () => isTestnet(client),
        getPChainAddress: () => getPChainAddress(client),
        getCorethAddress: () => getCorethAddress(client),
        createSubnet: (args: CreateSubnetParams) => createSubnet(client, args),
        createChain: (args: CreateChainParams) => createChain(client, args),
        convertToL1: (args: ConvertToL1Params) => convertToL1(client, args),
        registerL1Validator: (args: RegisterL1ValidatorParams) => registerL1Validator(client, args),
        setL1ValidatorWeight: (args: SetL1ValidatorWeightParams) => setL1ValidatorWeight(client, args),
        extractWarpMessageFromPChainTx: (args: ExtractWarpMessageFromTxParams) => extractWarpMessageFromPChainTx(client, args),
        getEthereumChain: () => getEthereumChain(client),
        extractChainInfo: (args: ExtractChainInfoParams) => extractChainInfo(client, args),
        getPChainBalance: () => getPChainBalance(client),
    }));
}
