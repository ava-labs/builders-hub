import { WalletClient } from "viem";
import { getRPCEndpoint } from "../utils/rpc";
import { isTestnet } from "./isTestnet";
import { CoreWalletRpcSchema } from "../rpcSchema";

export type ExtractChainInfoParams = {
    txId: string;
}

export type ExtractChainInfoResponse = {
    subnetID: string;
    chainName: string;
    vmID: string;
    genesisData: string;
}

// Define types for the API response structure
type PlatformGetTxResponse = {
    jsonrpc: string;
    result: {
        tx: {
            unsignedTx: {
                networkID: number;
                blockchainID: string;
                subnetID: string;
                chainName: string;
                vmID: string;
                genesisData: string;
                // other fields exist but not needed for our use case
            };
            credentials: Array<{
                signatures: string[];
            }>;
            id: string;
        };
        encoding: string;
    };
    id: number;
}

//TODO: rename
export async function extractChainInfo(client: WalletClient<any, any, any, CoreWalletRpcSchema>, { txId }: ExtractChainInfoParams): Promise<ExtractChainInfoResponse> {
    const isTestnetMode = await isTestnet(client);
    const rpcEndpoint = getRPCEndpoint(isTestnetMode);

    //Fixme: here we do a direct call instead of using avalanchejs, because we need to get the raw response from the node
    const response = await fetch(rpcEndpoint + "/ext/bc/P", {
        method: 'POST',
        headers: {
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'platform.getTx',
            params: {
                txID: txId,
                encoding: 'json'
            },
            id: 1
        })
    });

    const data = await response.json() as PlatformGetTxResponse | { error: { message: string } };

    // Type guard to check if we have an error response
    const isErrorResponse = (res: any): res is { error: { message: string } } => {
        return 'error' in res && typeof res.error?.message === 'string';
    };

    if (isErrorResponse(data)) {
        throw new Error(data.error.message);
    }

    if (!data.result) {
        throw new Error("Received unexpected response from node: " + JSON.stringify(data).slice(0, 150));
    }

    console.log(data);
    // Extract the relevant information from the response
    const { subnetID, chainName, vmID, genesisData } = data.result.tx.unsignedTx;

    return {
        subnetID,
        chainName,
        vmID,
        genesisData
    };
}
