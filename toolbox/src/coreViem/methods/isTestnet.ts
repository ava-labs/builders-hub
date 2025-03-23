import { CoreWalletRpcSchema } from "../rpcSchema";
import { WalletClient } from "viem";

export async function isTestnet(_: WalletClient<any, any, any, CoreWalletRpcSchema>) {
    return true;
    //     const chain = await client.request({
    //         method: "wallet_getEthereumChain",
    //         params: []
    //     })
    //     return chain.isTestnet;
}
