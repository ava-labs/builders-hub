import type { AvalancheWalletClient } from "@avalanche-sdk/client";
import type { CoreWalletRpcSchema } from "../rpcSchema";

export type GetActiveRulesAtResponse = Extract<CoreWalletRpcSchema[number], { Method: 'eth_getActiveRulesAt' }>['ReturnType'];

export async function getActiveRulesAt(client: AvalancheWalletClient): Promise<GetActiveRulesAtResponse> {
    try {
        // Try to call eth_getActiveRulesAt directly through the client
        const result = await client.request<
            Extract<CoreWalletRpcSchema[number], { Method: 'eth_getActiveRulesAt' }>
        >({
            method: 'eth_getActiveRulesAt',
            params: [],
        });

        return result;
    } catch (error: any) {
        // If the method doesn't exist, return an empty response
        if (error?.message?.includes('method') || error?.message?.includes('Method') || error?.message?.includes('not supported')) {
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

        // For other types of errors, re-throw
        throw error;
    }
} 