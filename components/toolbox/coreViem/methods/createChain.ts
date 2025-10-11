import type { AvalancheWalletClient } from "@avalanche-sdk/client";
import { getChains } from "../utils/glacier";

export type CreateChainParams = {
    chainName: string;
    subnetAuth: number[];
    subnetId: string;
    vmId: string;
    fxIds: string[];
    genesisData: string;
}

export async function createChain(client: AvalancheWalletClient, params: CreateChainParams): Promise<string> {
    // Parse genesis data from string to object
    const genesisDataObject = JSON.parse(params.genesisData);

    // Prepare the transaction using Avalanche SDK
    const txnRequest = await client.pChain.prepareCreateChainTxn({
        chainName: params.chainName,
        subnetAuth: params.subnetAuth,
        subnetId: params.subnetId,
        vmId: params.vmId,
        fxIds: params.fxIds,
        genesisData: genesisDataObject,
    });

    // Get the chain ID from the unsigned transaction to check for collisions
    const chainID = txnRequest.createChainTx.getBlockchainId().toString();

    // Check for chain ID collisions using Glacier API
    const existingChains = await getChains();
    const chainIdCollision = existingChains.find(chain =>
        chain.platformChainId === chainID
    );

    if (chainIdCollision) {
        throw new Error(`Chain ID collision detected. The generated chain ID "${chainID}" already exists.`);
    }

    // If no collision, proceed with sending the transaction
    const result = await client.sendXPTransaction(txnRequest);

    return result.txHash;
}
