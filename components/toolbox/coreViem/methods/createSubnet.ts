import type { AvalancheWalletClient } from "@avalanche-sdk/client";

export type CreateSubnetParams = {
    subnetOwners: string[];
}

export async function createSubnet(client: AvalancheWalletClient, params: CreateSubnetParams): Promise<string> {
    // Prepare the transaction using Avalanche SDK
    const txnRequest = await client.pChain.prepareCreateSubnetTxn({
        subnetOwners: {
            addresses: params.subnetOwners,
            threshold: 1, // Default threshold, can be made configurable if needed
        },
    });

    // Send the transaction using Avalanche SDK's sendXPTransaction
    const result = await client.sendXPTransaction(txnRequest);

    return result.txHash;
}
