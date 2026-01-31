import { useState } from 'react';
import { bytesToHex, hexToBytes } from 'viem';
import { packValidationUptimeMessage } from '@/components/toolbox/coreViem/utils/convertWarp';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useAvalancheSDKChainkit } from '@/components/toolbox/stores/useAvalancheSDKChainkit';

interface UptimeProofResult {
    uptimeSeconds: bigint;
    signedWarpMessage: string;
    unsignedWarpMessage: string;
}

export function useUptimeProof() {
    const { avalancheNetworkID } = useWalletStore();
    const { aggregateSignature } = useAvalancheSDKChainkit();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Fetch current validators and extract uptime for a specific validation ID
     */
    async function getValidatorUptime(
        validationID: string,
        rpcUrl: string
    ): Promise<bigint> {
        try {
            const validatorsRpcUrl = rpcUrl.replace('/rpc', '/validators');
            const response = await fetch(validatorsRpcUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "validators.getCurrentValidators",
                    params: {
                        nodeIDs: []
                    },
                    id: 1
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to fetch validators');
            }

            const data = await response.json();
            if (!data?.result?.validators) {
                throw new Error('No validators found in response');
            }

            const validator = data.result.validators.find(
                (v: any) => v.validationID === validationID
            );

            if (!validator) {
                throw new Error(`Validator with validationID ${validationID} not found`);
            }

            // Return uptimeSeconds as bigint
            return BigInt(validator.uptimeSeconds || 0);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`Failed to get validator uptime: ${message}`);
        }
    }

    /**
     * Create an unsigned uptime proof warp message
     */
    function createUptimeProofWarpMessage(
        validationID: Uint8Array,
        uptimeSeconds: bigint,
        signingSubnetId: string
    ): Uint8Array {
        try {
            const warpMessage = packValidationUptimeMessage(
                {
                    validationID,
                    uptime: uptimeSeconds,
                },
                avalancheNetworkID,
                signingSubnetId
            );

            return warpMessage;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            throw new Error(`Failed to create uptime proof warp message: ${message}`);
        }
    }

    /**
     * Sign uptime proof with retry logic
     * Tries different quorum percentages: 67%, then increases to 70%, 75%, 80%, etc.
     * If all high percentages fail, tries lower: 60%, 55%, 50%
     */
    async function signUptimeProofWithRetry(
        unsignedWarpMessage: string,
        signingSubnetId: string,
        maxRetries: number = 10
    ): Promise<string> {
        // Try standard quorum first (67%)
        const quorumSequence = [67, 70, 75, 80, 85, 90, 60, 55, 50, 45];

        let lastError: Error | null = null;

        for (let i = 0; i < Math.min(maxRetries, quorumSequence.length); i++) {
            const quorumPercentage = quorumSequence[i];

            try {
                console.log(`[UptimeProof] Attempting signature aggregation with ${quorumPercentage}% quorum...`);

                const { signedMessage } = await aggregateSignature({
                    message: unsignedWarpMessage,
                    signingSubnetId,
                    quorumPercentage,
                });

                console.log(`[UptimeProof] Successfully signed with ${quorumPercentage}% quorum`);
                return signedMessage;
            } catch (err) {
                lastError = err instanceof Error ? err : new Error(String(err));
                console.warn(`[UptimeProof] Failed with ${quorumPercentage}% quorum:`, lastError.message);

                // Continue to next quorum percentage
                continue;
            }
        }

        throw new Error(
            `Failed to sign uptime proof after ${maxRetries} attempts. Last error: ${lastError?.message || 'Unknown error'}`
        );
    }

    /**
     * Complete uptime proof flow: fetch uptime, create message, and sign
     */
    async function createAndSignUptimeProof(
        validationID: string,
        rpcUrl: string,
        signingSubnetId: string
    ): Promise<UptimeProofResult> {
        setIsLoading(true);
        setError(null);

        try {
            // Step 1: Get uptime from RPC
            const uptimeSeconds = await getValidatorUptime(validationID, rpcUrl);
            console.log(`[UptimeProof] Retrieved uptime: ${uptimeSeconds} seconds`);

            // Step 2: Create unsigned warp message
            const validationIDBytes = hexToBytes(validationID as `0x${string}`);
            const unsignedMessage = createUptimeProofWarpMessage(
                validationIDBytes,
                uptimeSeconds,
                signingSubnetId
            );
            const unsignedWarpMessage = bytesToHex(unsignedMessage);
            console.log(`[UptimeProof] Created unsigned warp message`);

            // Step 3: Sign with retry logic
            const signedWarpMessage = await signUptimeProofWithRetry(
                unsignedWarpMessage,
                signingSubnetId
            );
            console.log(`[UptimeProof] Successfully signed warp message`);

            return {
                uptimeSeconds,
                signedWarpMessage,
                unsignedWarpMessage,
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setError(message);
            throw new Error(message);
        } finally {
            setIsLoading(false);
        }
    }

    return {
        getValidatorUptime,
        createUptimeProofWarpMessage,
        signUptimeProofWithRetry,
        createAndSignUptimeProof,
        isLoading,
        error,
    };
}
