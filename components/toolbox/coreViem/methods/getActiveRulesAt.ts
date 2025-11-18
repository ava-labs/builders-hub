import type { Client, Transport, Chain, Account } from "viem";
import type { CoreWalletRpcSchema } from "../rpcSchema";

export type GetActiveRulesAtResponse = Extract<CoreWalletRpcSchema[number], { Method: 'eth_getActiveRulesAt' }>['ReturnType'];

export async function getActiveRulesAt(
    client: Client<Transport, Chain | undefined, Account | undefined>
): Promise<GetActiveRulesAtResponse> {
    try {
        const result = await client.transport.request({
            method: 'eth_getActiveRulesAt',
            params: [],
        }) as GetActiveRulesAtResponse;

        return result;
    } catch (error: any) {
        console.error('eth_getActiveRulesAt error:', error);
        
        const isMethodNotFound = 
            error?.code === -32601 || // JSON-RPC method not found error code
            (error?.message && (
                error.message.toLowerCase().includes('method not found') ||
                error.message.toLowerCase().includes('does not exist') ||
                error.message.toLowerCase().includes('is not available')
            ));
        
        if (isMethodNotFound) {
            console.warn('eth_getActiveRulesAt is not supported by this RPC endpoint, returning default (inactive) rules');
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

        // For other types of errors, re-throw so we can see what's actually wrong
        throw error;
    }
} 
