import { createWalletClient, custom, rpcSchema } from 'viem'
import { addChain, CoreWalletAddChainParameters } from './overrides/addChain'
import { CoreWalletRpcSchema } from './rpcSchema'
import { isTestnet } from './methods/isTestnet'
import { getPChainAddress } from './methods/getPChainAddress'
import { createSubnet, CreateSubnetParams } from './methods/createSubnet'
import { createChain, CreateChainParams } from './methods/createChain'
import { convertToL1, ConvertToL1Params } from './methods/convertToL1'
import { extractWarpMessageFromPChainTx, ExtractWarpMessageFromTxParams } from './methods/extractWarpMessageFromPChainTx'
// import { getEthereumChain } from './methods/getEthereumChain'
import { extractChainInfo, ExtractChainInfoParams } from './methods/extractChainInfo'
// import { sendTransaction } from './overrides/sendTransaction'

//Warning! This api is not stable yet, it will change in the future
export { type ConvertToL1Validator } from "./methods/convertToL1"

export function createCoreWalletClient(account: `0x${string}`) {
    return createWalletClient({
        transport: custom(window.avalanche!),
        account: account,
        rpcSchema: rpcSchema<CoreWalletRpcSchema>(),
    }).extend((client) => ({
        //override methods
        addChain: (args: CoreWalletAddChainParameters) => addChain(client, args),
        // sendTransaction: (args) => sendTransaction(client, args),

        //new methods
        isTestnet: () => isTestnet(client),
        getPChainAddress: () => getPChainAddress(client),
        createSubnet: (args: CreateSubnetParams) => createSubnet(client, args),
        createChain: (args: CreateChainParams) => createChain(client, args),
        convertToL1: (args: ConvertToL1Params) => convertToL1(client, args),
        extractWarpMessageFromPChainTx: (args: ExtractWarpMessageFromTxParams) => extractWarpMessageFromPChainTx(client, args),
        // getEthereumChain: () => getEthereumChain(client),
        extractChainInfo: (args: ExtractChainInfoParams) => extractChainInfo(client, args),
    }))
}
