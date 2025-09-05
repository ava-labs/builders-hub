import { WalletClient } from "viem";
import { CoreWalletRpcSchema } from "../rpcSchema";
import { isTestnet as _isTestnet } from "./isTestnet";
import { getBech32AddressFromAccountOrClient } from "node_modules/@avalanche-sdk/client/dist/methods/wallet/utils";
import { avalanche, avalancheFuji } from "@avalanche-sdk/client/chains";
import { createAvalancheWalletCoreClient } from "@avalanche-sdk/client";
import { networkIDs } from "@avalabs/avalanchejs";

export async function getCorethAddress(client: WalletClient<any, any, any, CoreWalletRpcSchema>) {
    const account = client.account;
    if (!account || !account.address) {
        throw new Error("No account found");
    }

    const isTestnet = await _isTestnet(client);
    const networkID = (isTestnet) ? networkIDs.FujiID : networkIDs.MainnetID

    const avalancheClient = createAvalancheWalletCoreClient({
        chain: isTestnet ? avalancheFuji : avalanche,
        transport: {
            type: "custom",
            provider: window.avalanche!,
        },
        account: account.address as `0x${string}`
    })

    return await getBech32AddressFromAccountOrClient(
        avalancheClient,
        avalancheClient.account,
        "C",
        networkIDs.getHRP(networkID)
    )
}
