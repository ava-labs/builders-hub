import { WalletClient } from "viem";
import { CoreWalletRpcSchema } from "../rpcSchema";

type GetActiveRulesAtResponse = Extract<CoreWalletRpcSchema[number], { Method: 'eth_getActiveRulesAt' }>['ReturnType'];

export async function getActiveRulesAt(client: WalletClient<any, any, any, CoreWalletRpcSchema>): Promise<GetActiveRulesAtResponse> {
    // Get the chain configuration from the wallet client
    const chain = await client.request({
        method: 'wallet_getEthereumChain',
        params: [],
    });

    // Get the first RPC URL from the chain
    const rpcUrl = chain?.rpcUrls?.[0];
    if (!rpcUrl) {
        throw new Error('No RPC URL available');
    }

    // Make a direct RPC call to the endpoint
    const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getActiveRulesAt',
            params: [],
        }),
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // If the method doesn't exist, return an empty response
    if (data.error?.message?.includes('method') || data.error?.message?.includes('Method')) {
        return {
            ethRules: {
                IsHomestead: false,
                IsEIP150: false,
                IsEIP155: false,
                IsEIP158: false,
                IsByzantium: false,
                IsConstantinople: false,
                IsPetersburg: false,
                IsIstanbul: false,
                IsCancun: false,
                IsVerkle: false,
            },
            avalancheRules: {
                IsSubnetEVM: false,
                IsDurango: false,
                IsEtna: false,
                IsFortuna: false,
            },
            precompiles: {}
        };
    }

    // For other types of errors, throw
    if (data.error) {
        throw new Error(data.error.message || 'RPC call failed');
    }

    return data.result;
} 