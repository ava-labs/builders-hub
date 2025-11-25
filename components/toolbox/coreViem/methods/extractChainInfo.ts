import type { AvalancheWalletClient } from "@avalanche-sdk/client";
import { getTx } from "@avalanche-sdk/client/methods/pChain";

export type ExtractChainInfoParams = {
    txId: string;
}

export type ExtractChainInfoResponse = {
    subnetId: string;
    chainName: string;
    vmID: string;
    genesisData: string;
}

//TODO: rename
export async function extractChainInfo(client: AvalancheWalletClient, { txId }: ExtractChainInfoParams): Promise<ExtractChainInfoResponse> {
    // Use SDK's getTx method to fetch the transaction
    const txData = await getTx(client.pChainClient, {
        txID: txId,
        encoding: 'json'
    });

    // The SDK returns the transaction data directly
    const data = txData as any;

    if (!data?.tx?.unsignedTx) {
        throw new Error("Received unexpected response from node: " + JSON.stringify(data).slice(0, 150));
    }

    // Extract the relevant information from the response
    const { subnetId, chainName, vmID, genesisData } = data.tx.unsignedTx;

    return {
        subnetId,
        chainName,
        vmID,
        genesisData
    };
}
