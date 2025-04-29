import { createWalletClient, custom, rpcSchema, DeployContractParameters } from 'viem'
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
export { type ConvertToL1Validator } from "./methods/convertToL1"
import { deployContract } from './overrides/deployContract'

export function createCoreWalletClient(account: `0x${string}`) {
    // Check if we're in a browser environment
    const isClient = typeof window !== 'undefined'

    // Only create a wallet client if we're in a browser
    if (!isClient) {
        return null as any; // Return null for SSR
    }

    // Check if window.avalanche exists and is an object
    if (!window.avalanche || typeof window.avalanche !== 'object') {
        return null as any; // Return null if Core wallet is not found
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
        extractWarpMessageFromPChainTx: (args: ExtractWarpMessageFromTxParams) => extractWarpMessageFromPChainTx(client, args),
        getEthereumChain: () => getEthereumChain(client),
        extractChainInfo: (args: ExtractChainInfoParams) => extractChainInfo(client, args),
        getPChainBalance: () => getPChainBalance(client),
    }))
}
