import type { AvalancheWalletClient } from "@avalanche-sdk/client";

/**
 * Parameters for setting the L1 validator weight on the P-Chain.
 * This is used for both changing weight and removing (setting weight to 0 implicitly).
 */
export type SetL1ValidatorWeightParams = {
    /** The signed Warp message from the C-Chain as a hex string (with or without "0x" prefix). */
    signedWarpMessage: string;
}

/**
 * Sends a transaction to the P-Chain to set the weight of an L1 validator.
 * This is used by both ChangeWeight and RemoveValidator components.
 *
 * @param client The Avalanche WalletClient instance.
 * @param params The parameters required for the transaction.
 * @returns A promise that resolves to the P-Chain transaction ID.
 */
export async function setL1ValidatorWeight(client: AvalancheWalletClient, params: SetL1ValidatorWeightParams): Promise<string> {
    const { signedWarpMessage } = params;

    // Ensure signedWarpMessage has '0x' prefix for SDK
    const message = signedWarpMessage.startsWith('0x') ? signedWarpMessage : `0x${signedWarpMessage}`;

    // Prepare the transaction using Avalanche SDK
    const txnRequest = await client.pChain.prepareSetL1ValidatorWeightTxn({
        message,
    });

    // Send the transaction
    const result = await client.sendXPTransaction(txnRequest);

    return result.txHash;
} 