import { networkIDs } from "@avalabs/avalanchejs";
import type { AvalancheWalletClient } from "@avalanche-sdk/client";
import { isTestnet } from "./isTestnet";
import { publicKeyToXPAddress } from '@avalanche-sdk/client/accounts'
import type { CoreWalletRpcSchema } from "../rpcSchema";

export async function getCorethAddress(client: AvalancheWalletClient) {
    const networkID = (await isTestnet(client)) ? networkIDs.FujiID : networkIDs.MainnetID;
    const hrp = networkIDs.getHRP(networkID);
    const pubkeys = await client.request<
        Extract<CoreWalletRpcSchema[number], { Method: 'avalanche_getAccountPubKey' }>
    >({
        method: "avalanche_getAccountPubKey",
        params: []
    });
    return `C-${publicKeyToXPAddress(pubkeys.evm, hrp)}`;
}