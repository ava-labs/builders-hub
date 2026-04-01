import { useMemo, useCallback } from "react";
import { Avalanche } from "@avalanche-sdk/chainkit";
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

/**
 * Custom hook for interacting with the Avalanche SDK
 * Replaces useAvaCloudSDK with the new avalanche-sdk-typescript implementation
 */
export const useAvalancheSDKChainkit = (customNetwork?: "mainnet" | "fuji") => {
    const { isTestnet } = useWalletStore();

    // Determine network name - follow the same pattern as existing avalanche-sdk usage
    const networkName = useMemo(() => {
        if (customNetwork) return customNetwork;
        // return getNetworkName()
        return isTestnet ? "fuji" : "mainnet";
    }, [customNetwork, isTestnet]); // [customNetwork, getNetworkName]);

    // Create SDK instance using avalanche-sdk-typescript
    const sdk = useMemo(() => {
        return new Avalanche({
            network: networkName,
        });
    }, [networkName]);

    // Signature aggregation method
    const aggregateSignature = useCallback(async ({
        message,
        justification,
        signingSubnetId,
        quorumPercentage = 67,
    }: SignatureAggregationParams): Promise<SignatureAggregationResult> => {
        try {
            // Call Glacier API directly — the SDK sends "signingSubnetId" but the
            // API expects "signingSubnet" (field name mismatch in avacloud-sdk).
            const network = isTestnet ? 'fuji' : 'mainnet';
            const body: Record<string, unknown> = {
                message,
                signingSubnet: signingSubnetId,
                quorumPercentage,
            };
            if (justification) {
                body.justification = justification;
            }

            const response = await fetch(
                `https://glacier-api.avax.network/v1/signatureAggregator/${network}/aggregateSignatures`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Signature aggregation failed (${response.status})`);
            }

            const result = await response.json();
            return { signedMessage: result.signedMessage };
        } catch (error) {
            console.error('Signature aggregation error:', error);
            throw error;
        }
    }, [isTestnet]);

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
