import { networkIDs } from "@avalabs/avalanchejs";
import { SigningKey } from "ethers";//TODO: remove etheres dependency
import { WalletClient } from "viem";
import {
    utils,
    secp256k1,
} from "@avalabs/avalanchejs";
import { Buffer as BufferPolyfill } from "buffer";
import { CoreWalletRpcSchema } from "../rpcSchema";
import { isTestnet } from "./isTestnet";

export async function getPChainAddress(client: WalletClient<any, any, any, CoreWalletRpcSchema>) {
    const networkID = (await isTestnet(client)) ? networkIDs.FujiID : networkIDs.MainnetID

    // TODO: Push Core to expose P-Chain address

    try {
        const pubkeys = await client.request({
            method: "avalanche_getAccountPubKey",
            params: []
        }) as { evm: string, xp: string }

        console.log("pubkeys", pubkeys);

        if (!pubkeys.xp.startsWith("0x")) {
            pubkeys.xp = `0x${pubkeys.xp}`;
        }
        const compressed = SigningKey.computePublicKey(pubkeys.xp, true).slice(2);
        const pubComp = BufferPolyfill.from(compressed, "hex");
        const address = secp256k1.publicKeyBytesToAddress(pubComp);
        return utils.format("P", networkIDs.getHRP(networkID), address)
    } catch (error) {
        console.log("Error getting P-Chain address:", error);
    }
}
