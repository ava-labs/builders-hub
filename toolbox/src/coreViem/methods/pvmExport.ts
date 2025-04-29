import { WalletClient, bytesToHex } from "viem";
import {
    utils,
    pvm,
    Context,
    TransferableOutput
} from "@avalabs/avalanchejs";
import { CoreWalletRpcSchema } from "../rpcSchema";
import { getRPCEndpoint } from "../utils/rpc";
import { isTestnet } from "./isTestnet";
import { getCorethAddress } from "./getCorethAddress";

// Define the type for window.avalanche response
interface AvalancheResponse {
    txID?: string;
    [key: string]: any;
}

/**
 * Parameters for exporting AVAX from P-Chain to C-Chain.
 */
export type PvmExportParams = {
    /** The amount of AVAX to export (e.g., "0.1"). */
    amount: string;
    /** The source P-Chain address. */
    pChainAddress: string;
}

/**
 * Creates and sends an export transaction from the P-Chain to the C-Chain using Core Wallet.
 *
 * @param client The Core WalletClient instance.
 * @param params The parameters required for the export transaction.
 * @returns A promise that resolves to the transaction response from Core Wallet.
 */
export async function pvmExport(client: WalletClient<any, any, any, CoreWalletRpcSchema>, params: PvmExportParams): Promise<AvalancheResponse> {
    const { amount, pChainAddress } = params;

    if (typeof window === 'undefined' || !window.avalanche) {
        throw new Error("Core Wallet extension not found or not running in browser environment");
    }

    const testnet = await isTestnet(client);
    const platformEndpoint = getRPCEndpoint(testnet);
    const context = await Context.getContextFromURI(platformEndpoint);
    
    // Get UTXOs from the P-Chain
    const pvmApi = new pvm.PVMApi(platformEndpoint);
    const utxoResponse = await pvmApi.getUTXOs({ addresses: [pChainAddress] });
    const utxos = utxoResponse.utxos;

    // Get the Coreth address (C-Chain address in Bech32 format)
    const corethAddress = await getCorethAddress(client);

    // Create the P-Chain export transaction
    const exportTx = pvm.newExportTx(
        context,
        context.cBlockchainID,
        [utils.bech32ToBytes(pChainAddress)],
        utxos,
        [
            TransferableOutput.fromNative(
                context.avaxAssetID,
                BigInt(Math.round(Number(amount) * 1e9)), // Convert AVAX to nAVAX
                [utils.bech32ToBytes(corethAddress)],
            ),
        ]
    );

    const txBytes = exportTx.toBytes();
    const txHex = bytesToHex(txBytes);
    console.log("P-Chain Export transaction created:", txHex);

    // Send transaction using window.avalanche
    const response = await window.avalanche.request({
        method: "avalanche_sendTransaction",
        params: {
            transactionHex: txHex,
            chainAlias: "P",
        },
    }) as AvalancheResponse;

    console.log("P-Chain Export transaction sent via Core:", response);
    return response;
}
