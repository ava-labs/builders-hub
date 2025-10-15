export type CoreWalletRpcSchema = [
    {
        Method: 'avalanche_getAccountPubKey',
        Parameters: []
        ReturnType: { xp: string, evm: string }
    },
    {
        Method: 'wallet_getEthereumChain',
        Parameters: []
        ReturnType: {
            chainId: string,
            chainName: string,
            rpcUrls: string[],
            nativeCurrency: {
                name: string,
                symbol: string,
                decimals: number
            },
            isTestnet: boolean
        }
    },
    {
        Method: 'eth_getActiveRulesAt',
        Parameters: []
        ReturnType: {
            ethRules: {
                IsHomestead: boolean;
                IsEIP150: boolean;
                IsEIP155: boolean;
                IsEIP158: boolean;
                IsByzantium: boolean;
                IsConstantinople: boolean;
                IsPetersburg: boolean;
                IsIstanbul: boolean;
                IsCancun: boolean;
                IsVerkle: boolean;
            };
            avalancheRules: {
                IsSubnetEVM: boolean;
                IsDurango: boolean;
                IsEtna: boolean;
                IsFortuna: boolean;
            };
            precompiles: {
                warpConfig?: { timestamp: number };
                contractDeployerAllowListConfig?: { timestamp: number };
                txAllowListConfig?: { timestamp: number };
                feeManagerConfig?: { timestamp: number };
                rewardManagerConfig?: { timestamp: number };
                contractNativeMinterConfig?: { timestamp: number };
            };
        }
    },
    {
        Method: 'avalanche_sendTransaction',
        Parameters: {
            transactionHex: string,
            chainAlias: "X" | "P" | "C",
            externalIndices?: number[],
            internalIndices?: number[],
            utxos?: string[],
            feeTolerance?: number
        }
        ReturnType: {
            txHash: string
        }
    }
]

export type PChainRpcSchema = [
    {
        Method: 'platform.getBalance',
        Parameters: {
            addresses: string[]
        }
        ReturnType: {
            balance: string;
            unlocked: string;
            lockedStakeable: string;
            lockedNotStakeable: string;
            utxoIDs: Array<{
                txID: string;
                outputIndex: number;
            }>;
        }
    }
]
