import type { AvalancheWalletClient } from "@avalanche-sdk/client";
import type { CoreWalletRpcSchema } from "../rpcSchema";

export type GetEthereumChainResponse = Extract<CoreWalletRpcSchema[number], { Method: 'wallet_getEthereumChain' }>['ReturnType'];

export async function getEthereumChain(client: AvalancheWalletClient): Promise<GetEthereumChainResponse> {
    const chain = await client.request<
        Extract<CoreWalletRpcSchema[number], { Method: 'wallet_getEthereumChain' }>
    >({
        method: 'wallet_getEthereumChain',
        params: [],
    });
    return chain;
}
