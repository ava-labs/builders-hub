import { WalletClient, bytesToHex } from "viem";
import {
    utils,
    evm,
    Context
} from "@avalabs/avalanchejs";
import { CoreWalletRpcSchema } from "../rpcSchema";
import { getRPCEndpoint } from "../utils/rpc";
import { isTestnet } from "./isTestnet";
import { JsonRpcProvider } from "ethers";

// Define the type for window.avalanche response
interface AvalancheResponse {
    txID?: string;
    [key: string]: any;
}

/**
 * Parameters for exporting AVAX from C-Chain to P-Chain.
 */
export type EvmExportParams = {
    /** The amount of AVAX to export (e.g., "0.1"). */
    amount: string;
    /** The destination P-Chain address. */
    pChainAddress: string;
    /** The source C-Chain (EVM) address. */
    walletEVMAddress: string;
}

/**
 * Creates and sends an export transaction from the C-Chain to the P-Chain using Core Wallet.
 *
 * @param client The Core WalletClient instance (needed for network info, but tx is sent via window.avalanche).
 * @param params The parameters required for the export transaction.
 * @returns A promise that resolves to the transaction response from Core Wallet.
 */
export async function evmExport(client: WalletClient<any, any, any, CoreWalletRpcSchema>, params: EvmExportParams): Promise<AvalancheResponse> {
    const { amount, pChainAddress, walletEVMAddress } = params;

    if (typeof window === 'undefined' || !window.avalanche) {
        throw new Error("Core Wallet extension not found or not running in browser environment");
    }

    const testnet = await isTestnet(client);
    const platformEndpoint = getRPCEndpoint(testnet);
    const context = await Context.getContextFromURI(platformEndpoint);
    const provider = new JsonRpcProvider(platformEndpoint + "/ext/bc/C/rpc");
    let evmapi = new evm.EVMApi(platformEndpoint);
    const baseFee = await evmapi.getBaseFee();
    const txCount = await provider.getTransactionCount(walletEVMAddress);

    const tx = evm.newExportTx(
        context,
        BigInt(Math.round(Number(amount) * 1e9)), // Convert AVAX to nAVAX
        context.pBlockchainID,
        utils.hexToBuffer(walletEVMAddress),
        [utils.bech32ToBytes(pChainAddress)],
        baseFee,
        BigInt(txCount),
    );

    const txBytes = tx.toBytes();
    const txHex = bytesToHex(txBytes);
    console.log("EVM Export transaction created:", txHex);

    // Send transaction using window.avalanche
    const response = await window.avalanche.request({
        method: "avalanche_sendTransaction",
        params: {
            transactionHex: txHex,
            chainAlias: "C",
        },
    }) as AvalancheResponse;

    console.log("EVM Export transaction sent via Core:", response);
    return response;
}