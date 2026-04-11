import React, { useState, useEffect } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Success } from '@/components/toolbox/components/Success';
import { Alert } from '@/components/toolbox/components/Alert';
import { hexToBytes, bytesToHex } from 'viem';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { packWarpIntoAccessList } from '@/components/toolbox/console/permissioned-l1s/ValidatorManager/packWarp';
import { useNativeTokenStakingManager, useERC20TokenStakingManager } from '@/components/toolbox/hooks/contracts';
import { packL1ValidatorWeightMessage } from '@/components/toolbox/coreViem/utils/convertWarp';
import { useAvalancheSDKChainkit } from '@/components/toolbox/stores/useAvalancheSDKChainkit';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';

type TokenType = 'native' | 'erc20';

interface CompleteValidatorRemovalProps {
    validationID?: string;
    stakingManagerAddress: string;
    tokenType: TokenType;
    subnetIdL1: string;
    signingSubnetId?: string;
    pChainTxId?: string;
    onSuccess: (data: { txHash: string; message: string }) => void;
    onError: (message: string) => void;
}

const CompleteValidatorRemoval: React.FC<CompleteValidatorRemovalProps> = ({
    validationID,
    stakingManagerAddress,
    tokenType,
    subnetIdL1,
    signingSubnetId,
    pChainTxId: initialPChainTxId,
    onSuccess,
    onError,
}) => {
    const { walletEVMAddress, avalancheNetworkID } = useWalletStore();
    const chainPublicClient = useChainPublicClient();
    const walletClient = useResolvedWalletClient();
    const { aggregateSignature } = useAvalancheSDKChainkit();
    const viemChain = useViemChainStore();
    const { notify } = useConsoleNotifications();

    const nativeStakingManager = useNativeTokenStakingManager(tokenType === 'native' ? stakingManagerAddress : null);
    const erc20StakingManager = useERC20TokenStakingManager(tokenType === 'erc20' ? stakingManagerAddress : null);

    const [pChainTxId, setPChainTxId] = useState<string>(initialPChainTxId || '');
    const [messageIndex, setMessageIndex] = useState<string>('0');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setErrorState] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [pChainSignature, setPChainSignature] = useState<string | null>(null);
    const [extractedData, setExtractedData] = useState<{
        validationID: string;
        nonce: bigint;
        weight: bigint;
    } | null>(null);
    const [rewardInfo, setRewardInfo] = useState<{
        stakeReturned: string;
        rewardsDistributed: boolean;
    } | null>(null);

    const tokenLabel = tokenType === 'native' ? 'Native Token' : 'ERC20 Token';

    // Update pChainTxId when prop changes
    useEffect(() => {
        if (initialPChainTxId && initialPChainTxId !== pChainTxId) {
            setPChainTxId(initialPChainTxId);
        }
    }, [initialPChainTxId]);

    const handleCompleteRemoval = async () => {
        setErrorState(null);
        setTxHash(null);
        setRewardInfo(null);
        setPChainSignature(null);
        setExtractedData(null);

        if (!walletClient || !chainPublicClient || !viemChain) {
            setErrorState("Wallet or chain configuration is not properly initialized.");
            onError("Wallet or chain configuration is not properly initialized.");
            return;
        }

        if (!stakingManagerAddress) {
            setErrorState("Staking Manager address is required.");
            onError("Staking Manager address is required.");
            return;
        }

        if (!pChainTxId.trim()) {
            setErrorState("P-Chain transaction ID is required.");
            onError("P-Chain transaction ID is required.");
            return;
        }

        if (!subnetIdL1) {
            setErrorState("L1 Subnet ID is required.");
            onError("L1 Subnet ID is required.");
            return;
        }

        const msgIndex = parseInt(messageIndex);
        if (isNaN(msgIndex) || msgIndex < 0) {
            setErrorState("Message index must be a non-negative number.");
            onError("Message index must be a non-negative number.");
            return;
        }

        setIsProcessing(true);
        try {
            // Step 1: Extract L1ValidatorWeightMessage from P-Chain transaction
            const coreWalletClient = useWalletStore.getState().coreWalletClient;
            if (!coreWalletClient) { throw new Error('This operation requires Core Wallet'); }
            const weightMessageData = await coreWalletClient.extractL1ValidatorWeightMessage({
                txId: pChainTxId
            });

            setExtractedData({
                validationID: weightMessageData.validationID,
                nonce: weightMessageData.nonce,
                weight: weightMessageData.weight
            });

            // Step 2: Create L1ValidatorWeightMessage for completion
            const validationIDBytes = hexToBytes(weightMessageData.validationID as `0x${string}`);
            const l1ValidatorWeightMessage = packL1ValidatorWeightMessage(
                {
                    validationID: validationIDBytes,
                    nonce: weightMessageData.nonce,
                    weight: weightMessageData.weight,
                },
                avalancheNetworkID,
                "11111111111111111111111111111111LpoYY"
            );

            // Step 3: Aggregate P-Chain signature
            const aggregateSignaturePromise = aggregateSignature({
                message: bytesToHex(l1ValidatorWeightMessage),
                signingSubnetId: signingSubnetId || subnetIdL1,
            });

            notify({
                type: 'local',
                name: 'Aggregate P-Chain Signatures'
            }, aggregateSignaturePromise);

            const signature = await aggregateSignaturePromise;
            
            setPChainSignature(signature.signedMessage);

            // Step 4: Package warp message into access list
            const signedPChainWarpMsgBytes = hexToBytes(`0x${signature.signedMessage}`);
            const accessList = packWarpIntoAccessList(signedPChainWarpMsgBytes);

            // Step 5: Call completeValidatorRemoval via hook with warp message
            const hash = tokenType === 'native'
                ? await nativeStakingManager.completeValidatorRemoval(msgIndex, accessList)
                : await erc20StakingManager.completeValidatorRemoval(msgIndex, accessList);

            setTxHash(hash);

            // Wait for confirmation
            const receipt = await chainPublicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
            if (receipt.status !== 'success') {
                throw new Error(`Transaction failed with status: ${receipt.status}`);
            }

            // Check for ValidatorRemovalCompleted event
            const hasRemovalEvent = receipt.logs.some(log =>
                log.topics[0]?.toLowerCase().includes('removal') ||
                log.topics[0]?.toLowerCase().includes('complete')
            );

            setRewardInfo({
                stakeReturned: 'Stake returned successfully',
                rewardsDistributed: hasRemovalEvent
            });

            const successMsg = hasRemovalEvent
                ? 'Validator removal completed and rewards distributed successfully.'
                : 'Validator removal completed successfully.';

            onSuccess({
                txHash: hash,
                message: successMsg
            });
        } catch (err: any) {
            let message = err instanceof Error ? err.message : String(err);

            // Provide more helpful error messages
            if (message.includes('User rejected')) {
                message = 'Transaction was rejected by user';
            } else if (message.includes('InvalidValidationID')) {
                message = 'Invalid validation ID. The validator may not exist or removal was not initiated.';
            } else if (message.includes('ValidatorNotRemovable')) {
                message = 'Validator cannot be removed yet. Ensure you have initiated removal first.';
            } else if (message.includes('InvalidValidatorStatus')) {
                message = 'Validator is not in the correct status for completion. Check if removal was initiated.';
            } else if (message.includes('InvalidNonce')) {
                message = 'Invalid nonce. The P-Chain transaction may be outdated or incorrect.';
            }

            setErrorState(`Failed to complete validator removal: ${message}`);
            onError(`Failed to complete validator removal: ${message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="space-y-4">
            {error && (
                <Alert variant="error">{error}</Alert>
            )}

            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
                <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                    Complete Removal ({tokenLabel} Staking)
                </h3>

                <div className="space-y-3">
                    {validationID && (
                        <div className="text-sm text-zinc-600 dark:text-zinc-400">
                            <p><strong>Validation ID:</strong> {validationID}</p>
                        </div>
                    )}

                    <Input
                        label="P-Chain Transaction ID"
                        value={pChainTxId}
                        onChange={setPChainTxId}
                        placeholder="Enter the P-Chain transaction ID from the previous step"
                        disabled={isProcessing}
                        helperText="The transaction ID from the P-Chain weight update step"
                    />

                    <Input
                        label="Message Index"
                        value={messageIndex}
                        onChange={setMessageIndex}
                        type="number"
                        min="0"
                        placeholder="0"
                        disabled={isProcessing}
                        helperText="Index of the warp message (usually 0)"
                    />

                    {subnetIdL1 && (
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
                            <p><strong>Signing Subnet ID:</strong> {signingSubnetId || subnetIdL1}</p>
                        </div>
                    )}
                </div>
            </div>

            {extractedData && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                    <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                        Extracted Weight Message Data
                    </h4>
                    <div className="text-xs space-y-1 text-blue-700 dark:text-blue-300">
                        <p><strong>Validation ID:</strong> <code>{extractedData.validationID}</code></p>
                        <p><strong>Nonce:</strong> {extractedData.nonce.toString()}</p>
                        <p><strong>Weight:</strong> {extractedData.weight.toString()}</p>
                    </div>
                </div>
            )}

            <Alert variant="info">
                <p className="text-sm">
                    <strong>What happens when you complete removal:</strong>
                </p>
                <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                    <li>Validator stake will be returned</li>
                    <li>Rewards will be calculated and distributed based on uptime</li>
                    <li>If applicable, delegation fees will become claimable</li>
                    <li>Validator will be removed from the active set</li>
                </ul>
            </Alert>

            <Button
                onClick={handleCompleteRemoval}
                disabled={isProcessing || !!txHash || !pChainTxId.trim()}
                loading={isProcessing}
            >
                {isProcessing ? 'Processing...' : 'Complete Validator Removal & Distribute Rewards'}
            </Button>

            {pChainSignature && !txHash && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        P-Chain signature aggregated. Waiting for transaction confirmation...
                    </p>
                </div>
            )}

            {txHash && (
                <>
                    <Success
                        label="Transaction Hash"
                        value={txHash}
                    />
                    {rewardInfo?.rewardsDistributed && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                            <p className="text-sm text-green-800 dark:text-green-200">
                                <strong>Success!</strong> Validator has been removed and rewards have been distributed.
                            </p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default CompleteValidatorRemoval;
