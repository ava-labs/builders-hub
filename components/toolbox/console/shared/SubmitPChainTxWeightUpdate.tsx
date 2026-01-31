import React, { useState, useEffect } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Success } from '@/components/toolbox/components/Success';
import { Alert } from '@/components/toolbox/components/Alert';
import { useAvalancheSDKChainkit } from '@/components/toolbox/stores/useAvalancheSDKChainkit';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';

export interface WeightUpdateEventData {
    validationID: `0x${string}`;
    nonce: bigint;
    weight: bigint;
    messageID?: `0x${string}`;
    delegationID?: `0x${string}`;
}

export interface SubmitPChainTxWeightUpdateProps {
    subnetIdL1: string;
    initialEvmTxHash?: string;
    signingSubnetId: string;
    /** Label for the transaction hash input */
    txHashLabel?: string;
    /** Placeholder for the transaction hash input */
    txHashPlaceholder?: string;
    /** Optional additional info to display */
    additionalInfo?: React.ReactNode;
    /** Called on successful P-Chain transaction */
    onSuccess: (pChainTxId: string, eventData?: WeightUpdateEventData) => void;
    /** Called on error */
    onError: (message: string) => void;
}

/**
 * Generic component for submitting weight update transactions to P-Chain.
 * Used for:
 * - Validator weight changes (ChangeWeight flow)
 * - Delegator registration (Delegation flow)
 * - Delegator removal
 * - Validator removal
 * 
 * All these operations use setL1ValidatorWeight on P-Chain.
 */
const SubmitPChainTxWeightUpdate: React.FC<SubmitPChainTxWeightUpdateProps> = ({
    subnetIdL1,
    initialEvmTxHash,
    signingSubnetId,
    txHashLabel = "EVM Transaction Hash",
    txHashPlaceholder = "Enter the transaction hash from the previous step (0x...)",
    additionalInfo,
    onSuccess,
    onError,
}) => {
    const { coreWalletClient, pChainAddress, publicClient } = useWalletStore();
    const { aggregateSignature } = useAvalancheSDKChainkit();
    const { notify } = useConsoleNotifications();
    
    const [evmTxHash, setEvmTxHash] = useState(initialEvmTxHash || '');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setErrorState] = useState<string | null>(null);
    const [txSuccess, setTxSuccess] = useState<string | null>(null);
    const [unsignedWarpMessage, setUnsignedWarpMessage] = useState<string | null>(null);
    const [signedWarpMessage, setSignedWarpMessage] = useState<string | null>(null);
    const [eventData, setEventData] = useState<WeightUpdateEventData | null>(null);

    // Update evmTxHash when initialEvmTxHash prop changes
    useEffect(() => {
        if (initialEvmTxHash && initialEvmTxHash !== evmTxHash) {
            setEvmTxHash(initialEvmTxHash);
        }
    }, [initialEvmTxHash]);

    const validateAndCleanTxHash = (hash: string): `0x${string}` | null => {
        if (!hash) return null;
        const cleanHash = hash.trim().toLowerCase();
        if (!cleanHash.startsWith('0x')) return null;
        if (cleanHash.length !== 66) return null;
        return cleanHash as `0x${string}`;
    };

    // Extract warp message and event data when transaction hash changes
    useEffect(() => {
        const extractWarpMessage = async () => {
            const validTxHash = validateAndCleanTxHash(evmTxHash);
            if (!publicClient || !validTxHash) {
                setUnsignedWarpMessage(null);
                setEventData(null);
                setSignedWarpMessage(null);
                return;
            }

            try {
                const receipt = await publicClient.waitForTransactionReceipt({ hash: validTxHash });
                if (!receipt.logs || receipt.logs.length === 0) {
                    throw new Error("Failed to get warp message from transaction receipt.");
                }

                console.log("[WeightUpdate] Transaction receipt logs:", receipt.logs.length);

                // Look for warp message from the warp precompile
                let extractedWarpMessage: string | null = null;
                const warpMessageTopic = "0x56600c567728a800c0aa927500f831cb451df66a7af570eb4df4dfbf4674887d";
                const warpPrecompileAddress = "0x0200000000000000000000000000000000000005";

                const warpEventLog = receipt.logs.find((log) => {
                    return log && log.address && log.address.toLowerCase() === warpPrecompileAddress.toLowerCase() &&
                        log.topics && log.topics[0] && log.topics[0].toLowerCase() === warpMessageTopic.toLowerCase();
                });

                if (warpEventLog && warpEventLog.data) {
                    console.log("[WeightUpdate] Found warp message from precompile event");
                    extractedWarpMessage = warpEventLog.data;
                } else if (receipt.logs.length > 1 && receipt.logs[1].data) {
                    console.log("[WeightUpdate] Using receipt.logs[1].data");
                    extractedWarpMessage = receipt.logs[1].data;
                } else if (receipt.logs[0].data) {
                    console.log("[WeightUpdate] Using receipt.logs[0].data as fallback");
                    extractedWarpMessage = receipt.logs[0].data;
                }

                if (!extractedWarpMessage) {
                    throw new Error("Could not extract warp message from transaction.");
                }

                setUnsignedWarpMessage(extractedWarpMessage);

                // Try to extract event data from different event types
                // InitiatedValidatorWeightUpdate: 0x6e350dd49b060d87f297206fd309234ed43156d890ced0f139ecf704310481d3
                // InitiatedDelegatorRegistration: look for events with delegation ID
                const weightUpdateEventTopic = "0x6e350dd49b060d87f297206fd309234ed43156d890ced0f139ecf704310481d3";
                
                const weightEventLog = receipt.logs.find((log) => {
                    return log && log.topics && log.topics[0] && 
                        log.topics[0].toLowerCase() === weightUpdateEventTopic.toLowerCase();
                });

                if (weightEventLog) {
                    // Parse InitiatedValidatorWeightUpdate event
                    const dataWithoutPrefix = weightEventLog.data.slice(2);
                    const nonce = BigInt("0x" + dataWithoutPrefix.slice(0, 64));
                    const messageID = "0x" + dataWithoutPrefix.slice(64, 128);
                    const weight = BigInt("0x" + dataWithoutPrefix.slice(128, 192));

                    setEventData({
                        validationID: weightEventLog.topics[1] as `0x${string}`,
                        nonce,
                        messageID: messageID as `0x${string}`,
                        weight,
                    });
                } else {
                    // Try to find any event with indexed bytes32 topics (generic weight update)
                    const genericEventLog = receipt.logs.find((log) => {
                        return log && log.topics && log.topics.length >= 2 && log.data && log.data.length > 2;
                    });

                    if (genericEventLog && genericEventLog.data.length >= 130) {
                        const dataWithoutPrefix = genericEventLog.data.slice(2);
                        const nonce = BigInt("0x" + dataWithoutPrefix.slice(0, 64));
                        const weight = dataWithoutPrefix.length >= 128 
                            ? BigInt("0x" + dataWithoutPrefix.slice(64, 128)) 
                            : 0n;

                        setEventData({
                            validationID: genericEventLog.topics[1] as `0x${string}`,
                            delegationID: genericEventLog.topics[2] as `0x${string}` || undefined,
                            nonce,
                            weight,
                        });
                    }
                }
                
                setErrorState(null);
            } catch (err: any) {
                const message = err instanceof Error ? err.message : String(err);
                setErrorState(`Failed to extract warp message: ${message}`);
                setUnsignedWarpMessage(null);
                setEventData(null);
                setSignedWarpMessage(null);
            }
        };

        extractWarpMessage();
    }, [evmTxHash, publicClient]);

    const handleSubmitPChainTx = async () => {
        setErrorState(null);
        setTxSuccess(null);

        if (!coreWalletClient) {
            setErrorState("Core wallet not found");
            return;
        }

        if (!evmTxHash.trim()) {
            setErrorState("EVM transaction hash is required.");
            onError("EVM transaction hash is required.");
            return;
        }
        if (!subnetIdL1) {
            setErrorState("L1 Subnet ID is required.");
            onError("L1 Subnet ID is required.");
            return;
        }
        if (!unsignedWarpMessage) {
            setErrorState("Unsigned warp message not found. Check the transaction hash.");
            onError("Unsigned warp message not found.");
            return;
        }
        if (!pChainAddress) {
            setErrorState("P-Chain address is missing. Please connect your wallet.");
            onError("P-Chain address is missing.");
            return;
        }

        setIsProcessing(true);
        try {
            // Step 1: Sign the warp message
            const aggregateSignaturePromise = aggregateSignature({
                message: unsignedWarpMessage,
                signingSubnetId: signingSubnetId || subnetIdL1,
                quorumPercentage: 67,
            });
            
            notify({
                type: 'local',
                name: 'Aggregate Signatures'
            }, aggregateSignaturePromise);
            
            const { signedMessage } = await aggregateSignaturePromise;
            setSignedWarpMessage(signedMessage);

            // Step 2: Submit to P-Chain using setL1ValidatorWeight
            const pChainTxIdPromise = coreWalletClient.setL1ValidatorWeight({
                signedWarpMessage: signedMessage,
            });
            
            notify({
                type: 'local',
                name: 'Submit P-Chain Transaction'
            }, pChainTxIdPromise);
            
            const pChainTxId = await pChainTxIdPromise;
            setTxSuccess(pChainTxId);
            onSuccess(pChainTxId, eventData || undefined);
        } catch (err: any) {
            let message = err instanceof Error ? err.message : String(err);

            if (message.includes('User rejected')) {
                message = 'Transaction was rejected by user';
            } else if (message.includes('insufficient funds')) {
                message = 'Insufficient P-Chain balance for transaction';
            } else if (message.includes('execution reverted')) {
                message = `Transaction reverted: ${message}`;
            } else if (message.includes('nonce')) {
                message = 'Transaction nonce error. Please try again.';
            }

            setErrorState(`P-Chain transaction failed: ${message}`);
            onError(`P-Chain transaction failed: ${message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleTxHashChange = (value: string) => {
        setEvmTxHash(value);
        setErrorState(null);
        setTxSuccess(null);
        setSignedWarpMessage(null);
    };

    // Don't render if no subnet is selected
    if (!subnetIdL1) {
        return (
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
                Please select an L1 subnet first.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {error && (
                <Alert variant="error">{error}</Alert>
            )}

            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
                <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                    Submit to P-Chain
                </h3>

                <div className="space-y-3">
                    <Input
                        label={txHashLabel}
                        value={evmTxHash}
                        onChange={handleTxHashChange}
                        placeholder={txHashPlaceholder}
                        disabled={isProcessing || txSuccess !== null}
                    />

                    {additionalInfo}
                </div>
            </div>

            {unsignedWarpMessage && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                        Warp message extracted successfully
                    </p>
                    {eventData && (
                        <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 space-y-1">
                            <p>Validation ID: {eventData.validationID?.slice(0, 18)}...</p>
                            {eventData.weight > 0n && <p>New Weight: {eventData.weight.toString()}</p>}
                            {eventData.delegationID && <p>Delegation ID: {eventData.delegationID?.slice(0, 18)}...</p>}
                        </div>
                    )}
                </div>
            )}

            {signedWarpMessage && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                    <p className="text-xs text-green-700 dark:text-green-300">
                        Warp message signed successfully
                    </p>
                </div>
            )}

            <Alert variant="info">
                <p className="text-sm">
                    <strong>This step will:</strong>
                </p>
                <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                    <li>Aggregate signatures from L1 validators (67% quorum)</li>
                    <li>Submit the signed warp message to the P-Chain</li>
                    <li>Update the validator&apos;s weight on the network</li>
                </ul>
            </Alert>

            <Button
                onClick={handleSubmitPChainTx}
                disabled={isProcessing || !unsignedWarpMessage || !!txSuccess}
                loading={isProcessing}
            >
                {isProcessing ? 'Processing...' : 'Sign & Submit to P-Chain'}
            </Button>

            {txSuccess && (
                <Success
                    label="P-Chain Transaction ID"
                    value={txSuccess}
                />
            )}
        </div>
    );
};

export default SubmitPChainTxWeightUpdate;
