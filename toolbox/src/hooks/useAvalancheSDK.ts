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
    const { isTestnet, getNetworkName } = useWalletStore();

    // Determine network name
    const networkName = useMemo(() => {
        if (customNetwork) return customNetwork;
        return getNetworkName();
    }, [customNetwork, getNetworkName]);

    // Create SDK instance
    const sdk = useMemo(() => {
        return new Avalanche({
            serverURL: isTestnet ? "https://api.avax-test.network" : "https://api.avax.network",
            network: networkName,
        });
    }, [isTestnet, networkName]);

    // Signature aggregation method
    const aggregateSignature = useCallback(async ({
        message,
        justification,
        signingSubnetId,
        quorumPercentage = 67,
    }: SignatureAggregationParams): Promise<SignatureAggregationResult> => {
        try {
            // Use the SDK's signature aggregation method
            const result = await sdk.data.signatureAggregator.aggregate({
                network: networkName,
                signatureAggregatorRequest: {
                    message,
                    signingSubnetId,
                    quorumPercentage,
                    justification,
                },
            });
            return { signedMessage: result.signedMessage };
        } catch (error) {
            console.error('Signature aggregation error:', error);
            throw error;
        }
    }, [sdk, networkName]);

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