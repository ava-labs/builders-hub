
import { networkIDs, secp256k1 } from "@avalabs/avalanchejs";
import { WalletClient } from "viem";
import {
    utils,
} from "@avalabs/avalanchejs";
import { CoreWalletRpcSchema } from "../rpcSchema";
import { isTestnet } from "./isTestnet";
import { Point } from "@noble/secp256k1";
import { XPAddress } from "@avalanche-sdk/client/accounts";


export async function getCorethAddress(client: WalletClient<any, any, any, CoreWalletRpcSchema>) {
    const networkID = (await isTestnet(client)) ? networkIDs.FujiID : networkIDs.MainnetID;
    const hrp = networkIDs.getHRP(networkID);
    const pubkeys = await client.request({
        method: "avalanche_getAccountPubKey",
        params: []
    }) as {evm: string, xp: string}
    return `C-${publicKeyToXPAddress(pubkeys.evm, hrp)}`;
}

const publicKeyToXPAddress = (publicKey: string, hrp: string) => {
    const point = Point.fromHex(utils.strip0x(publicKey));
    const compressedPubKey = new Uint8Array(point.toBytes(true));
    const address = secp256k1.publicKeyBytesToAddress(compressedPubKey);
    return utils.formatBech32(hrp, address) as XPAddress;
}