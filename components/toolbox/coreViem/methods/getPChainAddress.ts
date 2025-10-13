import { networkIDs } from "@avalabs/avalanchejs";
import { WalletClient } from "viem";
import {
    utils,
    secp256k1,
} from "@avalabs/avalanchejs";
import { Buffer as BufferPolyfill } from "buffer";
import { CoreWalletRpcSchema } from "../rpcSchema";
import { isTestnet } from "./isTestnet";
import { secp256k1 as nobleSecp256k1 } from '@noble/curves/secp256k1.js';

export async function getPChainAddress(client: WalletClient<any, any, any, CoreWalletRpcSchema>) {
    const networkID = (await isTestnet(client)) ? networkIDs.FujiID : networkIDs.MainnetID

    const pubkeys = await client.request({
        method: "avalanche_getAccountPubKey",
        params: []
    }) as { evm: string, xp: string }

    return getPChainAddressFromPublicKey(pubkeys.xp, networkID);
}

function getPChainAddressFromPublicKey(xpPubKey: string, networkID: number) {
    // Ensure the public key has 0x prefix
    if (!xpPubKey.startsWith("0x")) {
        xpPubKey = `0x${xpPubKey}`;
    }

    // Remove 0x prefix for processing
    const pubKeyHex = xpPubKey.slice(2);

    // Convert hex string to Uint8Array
    const pubKeyBytes = new Uint8Array(pubKeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

    // Use noble/curves to compress the public key
    // The public key is already in uncompressed format (04 prefix)
    // We just need to get the compressed version
    const point = nobleSecp256k1.Point.fromHex(pubKeyHex);
    const compressedBytes = point.toBytes(true); // true = compressed format

    // Convert to Buffer for avalanchejs compatibility
    const pubComp = BufferPolyfill.from(compressedBytes);

    // Use avalanchejs to convert to address
    const address = secp256k1.publicKeyBytesToAddress(pubComp);

    // Format as P-Chain address
    return utils.format("P", networkIDs.getHRP(networkID), address);
}

