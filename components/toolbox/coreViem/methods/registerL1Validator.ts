import type { AvalancheWalletClient } from "@avalanche-sdk/client";

/**
 * Parameters for registering an L1 validator on the P-Chain.
 */
export type RegisterL1ValidatorParams = {
    /** The initial balance for the validator in AVAX (e.g., "0.1"). */
    balance: string;
    /** The BLS Proof of Possession as a hex string (e.g., "0x..."). */
    blsProofOfPossession: string;
    /** The signed Warp message from the C-Chain as a hex string (with or without "0x" prefix). */
    signedWarpMessage: string;
}

/**
 * Sends a transaction to the P-Chain to register a new L1 validator.
 * This corresponds to the `registerOnPChain` step in the AddValidator component.
 *
 * @param client The Avalanche WalletClient instance.
 * @param params The parameters required for the registration transaction.
 * @returns A promise that resolves to the P-Chain transaction ID.
 */
export async function registerL1Validator(client: AvalancheWalletClient, params: RegisterL1ValidatorParams): Promise<string> {
    const { balance, blsProofOfPossession, signedWarpMessage } = params;

    // Ensure BLS Proof of Possession has '0x' prefix for SDK
    const blsSignature = blsProofOfPossession.startsWith('0x') ? blsProofOfPossession : `0x${blsProofOfPossession}`;

    // Ensure signedWarpMessage has '0x' prefix for SDK
    const message = signedWarpMessage.startsWith('0x') ? signedWarpMessage : `0x${signedWarpMessage}`;

    // Prepare the transaction using Avalanche SDK
    const txnRequest = await client.pChain.prepareRegisterL1ValidatorTxn({
        initialBalanceInAvax: Number(balance),
        blsSignature,
        message,
    });

    // Send the transaction
    const result = await client.sendXPTransaction(txnRequest);

    return result.txHash;
} 