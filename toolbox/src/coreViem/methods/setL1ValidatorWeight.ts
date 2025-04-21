import { WalletClient, bytesToHex } from "viem";
import {
    utils,
    pvm,
    Context
} from "@avalabs/avalanchejs";
import { CoreWalletRpcSchema } from "../rpcSchema";
import { isTestnet } from "./isTestnet";
import { getRPCEndpoint } from "../utils/rpc";

/**
 * Parameters for setting the L1 validator weight on the P-Chain.
 * This is used for both changing weight and removing (setting weight to 0 implicitly).
 */
export type SetL1ValidatorWeightParams = {
    /** The P-Chain address initiating the transaction. */
    pChainAddress: string;
    /** The signed Warp message from the C-Chain as a hex string (without "0x" prefix). */
    signedWarpMessage: string;
}

/**
 * Sends a transaction to the P-Chain to set the weight of an L1 validator.
 * This is used by both ChangeWeight and RemoveValidator components.
 *
 * @param client The Core WalletClient instance.
 * @param params The parameters required for the transaction.
 * @returns A promise that resolves to the P-Chain transaction ID.
 */
export async function setL1ValidatorWeight(client: WalletClient<any, any, any, CoreWalletRpcSchema>, params: SetL1ValidatorWeightParams): Promise<string> {
    const { pChainAddress, signedWarpMessage } = params;

    const rpcEndpoint = getRPCEndpoint(await isTestnet(client));
    const pvmApi = new pvm.PVMApi(rpcEndpoint);
    const context = await Context.getContextFromURI(rpcEndpoint);

    // Get fee state and UTXOs from P-Chain
    const feeState = await pvmApi.getFeeState();
    const { utxos } = await pvmApi.getUTXOs({ addresses: [pChainAddress] });

    // Ensure signedWarpMessage does not start with '0x' and convert to Uint8Array
    const messageHex = signedWarpMessage.startsWith('0x') ? signedWarpMessage.slice(2) : signedWarpMessage;
    const messageBytes = new Uint8Array(Buffer.from(messageHex, "hex"));

    const setWeightTx = pvm.e.newSetL1ValidatorWeightTx(
        {
            message: messageBytes,
            feeState,
            fromAddressesBytes: [utils.bech32ToBytes(pChainAddress)],
            utxos,
        },
        context,
    );

    const setWeightTxBytes = setWeightTx.toBytes();
    const setWeightTxHex = bytesToHex(setWeightTxBytes);

    // Submit the transaction to the P-Chain using Core Wallet
    const txID = (await client.request({
        method: "avalanche_sendTransaction",
        params: {
            transactionHex: setWeightTxHex,
            chainAlias: "P",
        },
    })) as string;

    return txID;
} 