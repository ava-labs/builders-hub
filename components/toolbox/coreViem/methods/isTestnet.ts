import type { AvalancheWalletClient } from "@avalanche-sdk/client";
import type { CoreWalletRpcSchema } from "../rpcSchema";

export async function isTestnet(client: AvalancheWalletClient) {
    const chain = await client.request<
        Extract<CoreWalletRpcSchema[number], { Method: 'wallet_getEthereumChain' }>
    >({
        method: "wallet_getEthereumChain",
        params: []
    });
    return chain.isTestnet;
}
