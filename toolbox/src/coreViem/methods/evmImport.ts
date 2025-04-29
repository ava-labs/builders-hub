import { WalletClient, bytesToHex } from "viem";
import {
    utils,
    evm,
    Context
} from "@avalabs/avalanchejs";
import { CoreWalletRpcSchema } from "../rpcSchema";
import { getRPCEndpoint } from "../utils/rpc";
import { isTestnet } from "./isTestnet";
import { getCorethAddress } from "./getCorethAddress";

/**
 * Parameters for importing AVAX from P-Chain to C-Chain.
 */
export type EvmImportTxParams = {
    /** The destination C-Chain (EVM) address. */
    walletEVMAddress: string;
}

/**
 * Creates and sends an import transaction from the P-Chain to the C-Chain using Core Wallet.
 *
 * @param client The Core WalletClient instance.
 * @param params The parameters required for the import transaction.
 * @returns A promise that resolves to the transaction response from Core Wallet.
 */
export async function evmImportTx(client: WalletClient<any, any, any, CoreWalletRpcSchema>, params: EvmImportTxParams): Promise<string> {
    const { walletEVMAddress } = params;

    if (typeof window === 'undefined' || !window.avalanche) {
        throw new Error("Core Wallet extension not found or not running in browser environment");
    }

    const testnet = await isTestnet(client);
    const platformEndpoint = getRPCEndpoint(testnet);
    const context = await Context.getContextFromURI(platformEndpoint);
    
    // Get the C-Chain API and base fee
    const evmApi = new evm.EVMApi(platformEndpoint);
    const baseFee = await evmApi.getBaseFee();
    
    // Get UTXOs from the P chain that can be imported
    const corethAddress = await getCorethAddress(client);
    console.log("Coreth address for import:", corethAddress);

    const { utxos } = await evmApi.getUTXOs({
        sourceChain: 'P',
        addresses: [corethAddress]
    });

    console.log("UTXOs available for import:", utxos);

    // Create the C-Chain import transaction
    const importTx = evm.newImportTx(
        context,
        utils.hexToBuffer(walletEVMAddress),
        [utils.bech32ToBytes(corethAddress)],
        utxos,
        context.pBlockchainID,
        baseFee,
    );

    const importTxBytes = importTx.toBytes();
    const importTxHex = bytesToHex(importTxBytes);
    console.log("C-Chain Import transaction created:", importTxHex);

    // Send transaction using window.avalanche
    const response = await window.avalanche.request({
        method: "avalanche_sendTransaction",
        params: {
            transactionHex: importTxHex,
            chainAlias: "C",
            utxos: utxos
        },
    });

    console.log("C-Chain Import transaction sent via Core:", response);
    return String(response);
}
