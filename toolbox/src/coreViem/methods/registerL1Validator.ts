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
 * Parameters for registering an L1 validator on the P-Chain.
 */
export type RegisterL1ValidatorParams = {
    /** The P-Chain address initiating the registration. */
    pChainAddress: string;
    /** The initial balance for the validator in AVAX (e.g., "0.1"). */
    balance: string;
    /** The BLS Proof of Possession as a hex string (e.g., "0x..."). */
    blsProofOfPossession: string;
    /** The signed Warp message from the C-Chain as a hex string (without "0x" prefix). */
    signedWarpMessage: string;
}

/**
 * Sends a transaction to the P-Chain to register a new L1 validator.
 * This corresponds to the `registerOnPChain` step in the AddValidator component.
 *
 * @param client The Core WalletClient instance.
 * @param params The parameters required for the registration transaction.
 * @returns A promise that resolves to the P-Chain transaction ID.
 */
export async function registerL1Validator(client: WalletClient<any, any, any, CoreWalletRpcSchema>, params: RegisterL1ValidatorParams): Promise<string> {
    const { pChainAddress, balance, blsProofOfPossession, signedWarpMessage } = params;

    const rpcEndpoint = getRPCEndpoint(await isTestnet(client));
    const pvmApi = new pvm.PVMApi(rpcEndpoint);
    const context = await Context.getContextFromURI(rpcEndpoint);

    // Get fee state and UTXOs from P-Chain
    const feeState = await pvmApi.getFeeState();
    const { utxos } = await pvmApi.getUTXOs({ addresses: [pChainAddress] });

    // Convert balance from AVAX to nAVAX (1 AVAX = 1e9 nAVAX)
    const balanceInNanoAvax = BigInt(Number(balance) * 1e9);

    // Ensure BLS Proof of Possession starts with '0x' and convert to Uint8Array
    const popHex = blsProofOfPossession.startsWith('0x') ? blsProofOfPossession.slice(2) : blsProofOfPossession;
    const blsSignatureBytes = new Uint8Array(Buffer.from(popHex, "hex"));

    // Ensure signedWarpMessage does not start with '0x' and convert to Uint8Array
    const messageHex = signedWarpMessage.startsWith('0x') ? signedWarpMessage.slice(2) : signedWarpMessage;
    const messageBytes = new Uint8Array(Buffer.from(messageHex, "hex"));


    const unsignedRegisterValidatorTx = pvm.e.newRegisterL1ValidatorTx(
        {
            balance: balanceInNanoAvax,
            blsSignature: blsSignatureBytes,
            message: messageBytes,
            feeState,
            fromAddressesBytes: [utils.bech32ToBytes(pChainAddress)],
            utxos,
        },
        context,
    );

    const unsignedRegisterValidatorTxBytes = unsignedRegisterValidatorTx.toBytes();
    const unsignedRegisterValidatorTxHex = bytesToHex(unsignedRegisterValidatorTxBytes);

    // Submit the transaction to the P-Chain using Core Wallet
    const txID = (await client.request({
        method: "avalanche_sendTransaction",
        params: {
            transactionHex: unsignedRegisterValidatorTxHex,
            chainAlias: "P",
        },
    })) as string;

    return txID;
} 