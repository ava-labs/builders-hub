import React, { useState, useEffect } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Success } from '@/components/toolbox/components/Success';
import { Alert } from '@/components/toolbox/components/Alert';
import { useAvalancheSDKChainkit } from '@/components/toolbox/stores/useAvalancheSDKChainkit';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { useSubmitPChainTx } from '@/components/toolbox/hooks/useSubmitPChainTx';
import { Check } from 'lucide-react';
import { extractWarpMessageFromReceipt, validateAndCleanTxHash } from '@/components/toolbox/utils/warp';
import { PChainManualSubmit } from '@/components/toolbox/components/PChainManualSubmit';
import { StepFlowCard } from '@/components/toolbox/components/StepCard';
import { parsePChainError } from '@/components/toolbox/hooks/contracts';

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
    const { coreWalletClient, pChainAddress, isTestnet } = useWalletStore();
    const chainPublicClient = useChainPublicClient();
    const walletType = useWalletStore((s) => s.walletType);
    const isCoreWallet = walletType === 'core';
    const { aggregateSignature } = useAvalancheSDKChainkit();
    const { notify } = useConsoleNotifications();
    const { submitPChainTx } = useSubmitPChainTx();

    const [evmTxHash, setEvmTxHash] = useState(initialEvmTxHash || '');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setErrorState] = useState<string | null>(null);
    const [txSuccess, setTxSuccess] = useState<string | null>(null);
    const [unsignedWarpMessage, setUnsignedWarpMessage] = useState<string | null>(null);
    const [signedWarpMessage, setSignedWarpMessage] = useState<string | null>(null);
    const [eventData, setEventData] = useState<WeightUpdateEventData | null>(null);
    const [manualPChainTxId, setManualPChainTxId] = useState('');

    // Update evmTxHash when initialEvmTxHash prop changes
    useEffect(() => {
        if (initialEvmTxHash && initialEvmTxHash !== evmTxHash) {
            setEvmTxHash(initialEvmTxHash);
        }
    }, [initialEvmTxHash]);

    // Extract warp message and event data when transaction hash changes
    useEffect(() => {
        let cancelled = false;
        const extractWarpMessage = async () => {
            const validTxHash = validateAndCleanTxHash(evmTxHash);
            if (!chainPublicClient || !validTxHash) {
                setUnsignedWarpMessage(null);
                setEventData(null);
                setSignedWarpMessage(null);
                return;
            }

            try {
                const receipt = await chainPublicClient.waitForTransactionReceipt({ hash: validTxHash });
                if (cancelled) return;
                if (receipt.status !== 'success') {
                    throw new Error('The source transaction reverted. Check the transaction before proceeding.');
                }

                const extractedWarpMessage = extractWarpMessageFromReceipt(receipt);
                if (cancelled) return;
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
                if (cancelled) return;
                const message = err instanceof Error ? err.message : String(err);
                setErrorState(`Failed to extract warp message: ${message}`);
                setUnsignedWarpMessage(null);
                setEventData(null);
                setSignedWarpMessage(null);
            }
        };

        extractWarpMessage();
        return () => { cancelled = true; };
    }, [evmTxHash, chainPublicClient]);

    const handleSubmitPChainTx = async () => {
        setErrorState(null);
        setTxSuccess(null);

        if (isCoreWallet && !coreWalletClient) {
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
        if (isCoreWallet && !pChainAddress) {
            setErrorState("P-Chain address is missing. Please connect your wallet.");
            onError("P-Chain address is missing.");
            return;
        }

        setIsProcessing(true);
        try {
            if (!signingSubnetId) {
                throw new Error("Signing subnet ID not available. The validator manager details may still be loading — wait a moment and retry.");
            }

            // Step 1: Sign the warp message
            const aggregateSignaturePromise = aggregateSignature({
                message: unsignedWarpMessage,
                signingSubnetId,
                quorumPercentage: 67
            });

            notify({
                type: 'local',
                name: 'Aggregate Signatures'
            }, aggregateSignaturePromise);

            const { signedMessage } = await aggregateSignaturePromise;
            setSignedWarpMessage(signedMessage);

            if (!isCoreWallet) {
                // Generic wallet: aggregation done, CLI command shown in render
                return;
            }

            // Step 2: Submit to P-Chain using setL1ValidatorWeight
            const pChainTxId = await submitPChainTx(async (client) => {
                const pChainTxIdPromise = client.setL1ValidatorWeight({
                    signedWarpMessage: signedMessage,
                });

                notify({
                    type: 'local',
                    name: 'Submit P-Chain Transaction'
                }, pChainTxIdPromise);

                return pChainTxIdPromise;
            });

            setTxSuccess(pChainTxId);
            onSuccess(pChainTxId, eventData || undefined);
        } catch (err: any) {
            const message = parsePChainError(err);

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
        setManualPChainTxId('');
    };

    const handleContinueWithManualTxId = (pChainTxId: string) => {
        setTxSuccess(pChainTxId);
        onSuccess(pChainTxId, eventData || undefined);
    };

    const generateCLICommand = () => {
        if (!signedWarpMessage) return '';
        const network = isTestnet ? 'fuji' : 'mainnet';
        return [
            `platform l1 set-weight \\`,
            `  --message "${signedWarpMessage}" \\`,
            `  --network ${network} \\`,
            `  --key-name <your-key-name>`,
        ].join('\n');
    };

    // Don't render if no subnet is selected
    if (!subnetIdL1) {
        return (
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
                Please select an L1 subnet first.
            </div>
        );
    }

    const step1Complete = !!unsignedWarpMessage;
    const step2Complete = !!signedWarpMessage;
    const step3Complete = !!txSuccess;

    return (
        <div className="space-y-3">
            {error && (
                <Alert variant="error">{error}</Alert>
            )}

            {/* Step 1: Extract Warp Message */}
            <StepFlowCard step={1} title="Extract Warp Message" description="Enter the EVM transaction hash to extract the unsigned Warp message" isComplete={step1Complete}>
                <div className="mt-2">
                    <Input
                        label={txHashLabel}
                        value={evmTxHash}
                        onChange={handleTxHashChange}
                        placeholder={txHashPlaceholder}
                        disabled={isProcessing || txSuccess !== null}
                    />
                </div>
                {additionalInfo}
                {step1Complete && eventData && (
                    <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 font-mono">
                            <span className="text-green-600 font-sans font-medium">Validation ID:</span>
                            <code className="bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded text-[10px]">{eventData.validationID}</code>
                        </div>
                        {eventData.weight > 0n && (
                            <div className="flex items-center gap-1.5 text-xs">
                                <span className="text-green-600 dark:text-green-400 font-medium">New Weight:</span>
                                <code className="bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded text-[10px] font-mono">{eventData.weight.toString()}</code>
                            </div>
                        )}
                        {eventData.delegationID && (
                            <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 font-mono">
                                <span className="text-green-600 font-sans font-medium">Delegation ID:</span>
                                <code className="bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded text-[10px]">{eventData.delegationID}</code>
                            </div>
                        )}
                        <details className="mt-1">
                            <summary className="text-[10px] text-zinc-400 cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300">
                                Show unsigned Warp message ({unsignedWarpMessage ? unsignedWarpMessage.length / 2 : 0} bytes)
                            </summary>
                            <div className="mt-1">
                                <DynamicCodeBlock lang="text" code={unsignedWarpMessage || ''} />
                            </div>
                        </details>
                    </div>
                )}
            </StepFlowCard>

            {/* Step 2: Aggregate Signatures */}
            <StepFlowCard step={2} title="Sign & Submit to P-Chain" description="Aggregate BLS signatures from L1 validators and submit the weight update" isComplete={step2Complete} isActive={step1Complete}>
                {step2Complete ? (
                    <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                            <Check className="w-3.5 h-3.5" />
                            <span className="text-xs font-medium">Signatures aggregated</span>
                        </div>
                        <details>
                            <summary className="text-[10px] text-zinc-400 cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300">
                                Show signed Warp message ({signedWarpMessage ? signedWarpMessage.length / 2 : 0} bytes)
                            </summary>
                            <div className="mt-1">
                                <DynamicCodeBlock lang="text" code={signedWarpMessage || ''} />
                            </div>
                        </details>
                    </div>
                ) : step1Complete && !step3Complete ? (
                    <div className="mt-2">
                        <Button
                            onClick={handleSubmitPChainTx}
                            disabled={isProcessing || !unsignedWarpMessage}
                            loading={isProcessing}
                            className="w-full"
                        >
                            {isProcessing ? 'Processing...' : (isCoreWallet ? 'Sign & Submit to P-Chain' : 'Aggregate Signatures')}
                        </Button>
                    </div>
                ) : null}
            </StepFlowCard>

            {/* Non-Core: CLI command */}
            {!isCoreWallet && signedWarpMessage && !txSuccess && (
                <PChainManualSubmit
                    cliCommand={generateCLICommand()}
                    onSubmit={handleContinueWithManualTxId}
                />
            )}

            {/* Step 3: Success */}
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
