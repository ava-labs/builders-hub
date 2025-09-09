
import { networkIDs } from "@avalabs/avalanchejs";
import { WalletClient } from "viem";
import { CoreWalletRpcSchema } from "../rpcSchema";
import { isTestnet } from "./isTestnet";
import { publicKeyToXPAddress } from '@avalanche-sdk/client/accounts'


export async function getCorethAddress(client: WalletClient<any, any, any, CoreWalletRpcSchema>) {
    const networkID = (await isTestnet(client)) ? networkIDs.FujiID : networkIDs.MainnetID;
    const hrp = networkIDs.getHRP(networkID);
    const pubkeys = await client.request({
        method: "avalanche_getAccountPubKey",
        params: []
    }) as {evm: string, xp: string}
    return `C-${publicKeyToXPAddress(pubkeys.evm, hrp)}`;
}