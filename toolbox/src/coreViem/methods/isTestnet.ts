import { CoreWalletRpcSchema } from "../rpcSchema";
import { WalletClient } from "viem";

export async function isTestnet(client: WalletClient<any, any, any, CoreWalletRpcSchema>) {
    const chain = await client.request({
        method: "wallet_getEthereumChain",
        params: []
    })
    return chain.isTestnet;
}
