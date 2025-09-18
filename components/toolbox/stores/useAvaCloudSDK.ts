import { useMemo, useCallback } from "react";
import { AvaCloudSDK } from "@avalabs/avacloud-sdk";
import { GlobalParamNetwork } from "@avalabs/avacloud-sdk/models/components";
import { useWalletStore } from "./walletStore";

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
    includeInactiveL1Validators?: boolean;
}

// Types for subnet operations  
interface GetSubnetByIdParams {
    subnetId: string;
}

export const useAvaCloudSDK = (customNetwork?: GlobalParamNetwork) => {
    const { isTestnet, getNetworkName } = useWalletStore();

    // Determine network name
    const networkName = useMemo(() => {
        if (customNetwork) return customNetwork;
        return getNetworkName();
    }, [customNetwork, getNetworkName]);

    // Create SDK instance
    const sdk = useMemo(() => {
        return new AvaCloudSDK({
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
            // Use the SDK's built-in signature aggregation method
            const signatureAggregatorRequest: any = {
                message,
                signingSubnetId,
                quorumPercentage,
            };

            // Add justification if provided
            if (justification) {
                signatureAggregatorRequest.justification = justification;
            }

            const result = await sdk.data.signatureAggregator.aggregate({
                signatureAggregatorRequest
            });
            return { signedMessage: result.signedMessage };
        } catch (error) {
            console.error('Signature aggregation error:', error);
            throw error;
        }
    }, [sdk]);

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
        includeInactiveL1Validators = false,
    }: ListL1ValidatorsParams) => {
        return await sdk.data.primaryNetwork.listL1Validators({
            network: networkName,
            subnetId,
            pageToken,
            pageSize,
            includeInactiveL1Validators,
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