import type { AvalancheWalletClient } from "@avalanche-sdk/client";
import { getPChainAddress } from "./getPChainAddress";
import type { PChainRpcSchema } from "../rpcSchema";

export async function getPChainBalance(client: AvalancheWalletClient): Promise<bigint> {
    const pChainAddress = await getPChainAddress(client);

    const balance = await client.pChainClient.request<
        Extract<PChainRpcSchema[number], { Method: 'platform.getBalance' }>
    >({
        method: 'platform.getBalance',
        params: {
            addresses: [pChainAddress],
        },
    });

    return BigInt(balance.balance);
}
