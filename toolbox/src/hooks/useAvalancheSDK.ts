import { useMemo, useCallback } from "react";
import { Avalanche } from "@avalanche-sdk/data";
import { useWalletStore } from "../stores/walletStore";

// Types for signature aggregation
interface SignatureAggregationParams {
    message: string;
    justification?: string;
    signingSubnetId: string;
    quorumPercentage?: number;
}

interface SignatureAggregationResult {
    signedMessage: string;
}

// Types for L1 validators
interface ListL1ValidatorsParams {
    subnetId: string;
    pageToken?: string;
    pageSize?: number;
}

// Types for subnet operations  
interface GetSubnetByIdParams {
    subnetId: string;
}

export const useAvalancheSDK = (customNetwork?: "mainnet" | "fuji") => {
    const { isTestnet, getNetworkName, walletChainId } = useWalletStore();

    // Determine network name
    const networkName = useMemo(() => {
        if (customNetwork) return customNetwork;
        return getNetworkName();
    }, [customNetwork, getNetworkName]);

    // Create SDK instance
    const sdk = useMemo(() => {
        const sdkConfig = {
            chainId: walletChainId.toString(),
            serverURL: "https://glacier-api.avax.network",
            network: networkName,
        };
        return new Avalanche(sdkConfig);
    }, [isTestnet, networkName, walletChainId]);

    // Signature aggregation method
    const aggregateSignature = useCallback(async ({
        message,
        justification,
        signingSubnetId,
        quorumPercentage = 67,
    }: SignatureAggregationParams): Promise<SignatureAggregationResult> => {
        try {
            const requestPayload = {
                network: networkName,
                signatureAggregatorRequest: {
                    message,
                    signingSubnetId,
                    quorumPercentage,
                    justification,
                },
            };

            const result = await sdk.data.signatureAggregator.aggregate(requestPayload);
            return { signedMessage: result.signedMessage };
        } catch (error) {
            console.error('Signature aggregation error:', error);
            throw error;
        }
    }, [sdk, networkName, walletChainId, isTestnet]);

    // Primary Network - Subnet operations
    const getSubnetById = useCallback(async ({ subnetId }: GetSubnetByIdParams) => {
        return await sdk.data.primaryNetwork.getSubnetById({
            network: networkName,
            subnetId,
        });
    }, [sdk, networkName]);

    // Primary Network - L1 Validator operations  
    const listL1Validators = useCallback(async ({
        subnetId,
        pageToken,
        pageSize,
    }: ListL1ValidatorsParams) => {
        return await sdk.data.primaryNetwork.listL1Validators({
            network: networkName,
            subnetId,
            pageToken,
            pageSize,
        });
    }, [sdk, networkName]);

    return {
        // Raw SDK access for advanced usage
        sdk,
        networkName,

        // Signature aggregation (most common pattern)
        aggregateSignature,

        // Primary Network API methods
        getSubnetById,
        listL1Validators,
    };
}; 