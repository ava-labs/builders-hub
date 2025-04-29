import { WalletClient, bytesToHex } from "viem";
import {
    utils,
    pvm,
    Context
} from "@avalabs/avalanchejs";
import { CoreWalletRpcSchema } from "../rpcSchema";
import { getRPCEndpoint } from "../utils/rpc";
import { isTestnet } from "./isTestnet";

/**
 * Parameters for importing AVAX from C-Chain to P-Chain.
 */
export type PvmImportParams = {
    /** The P-Chain address that will receive the imported funds. */
    pChainAddress: string;
}

/**
 * Creates and sends an import transaction to the P-Chain using Core Wallet.
 * This imports AVAX that was previously exported from the C-Chain.
 *
 * @param client The Core WalletClient instance.
 * @param params The parameters required for the import transaction.
 * @returns A promise that resolves to the transaction response from Core Wallet.
 */
export async function pvmImport(client: WalletClient<any, any, any, CoreWalletRpcSchema>, params: PvmImportParams): Promise<string> {
    const { pChainAddress } = params;

    if (typeof window === 'undefined' || !window.avalanche) {
        throw new Error("Core Wallet extension not found or not running in browser environment");
    }

    const testnet = await isTestnet(client);
    const platformEndpoint = getRPCEndpoint(testnet);
    const context = await Context.getContextFromURI(platformEndpoint);
    
    // Get UTXOs from the C-Chain that can be imported to P-Chain
    const pvmApi = new pvm.PVMApi(platformEndpoint);
    const { utxos } = await pvmApi.getUTXOs({ 
        sourceChain: 'C', 
        addresses: [pChainAddress] 
    });

    // Create the P-Chain import transaction
    const importTx = pvm.newImportTx(
        context,
        context.cBlockchainID,
        utxos,
        [utils.bech32ToBytes(pChainAddress)],
        [utils.bech32ToBytes(pChainAddress)],
    );

    const importTxBytes = importTx.toBytes();
    const importTxHex = bytesToHex(importTxBytes);
    console.log("P-Chain Import transaction created:", importTxHex);

    // Send transaction using window.avalanche
    const response = await window.avalanche.request({
        method: "avalanche_sendTransaction",
        params: {
            transactionHex: importTxHex,
            chainAlias: "P",
            utxos: utxos
        },
    });

    console.log("P-Chain Import transaction sent via Core:", response);
    return String(response);
}
