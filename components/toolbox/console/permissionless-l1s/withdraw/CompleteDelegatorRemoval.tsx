import React, { useState } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Success } from '@/components/toolbox/components/Success';
import { Alert } from '@/components/toolbox/components/Alert';
import NativeTokenStakingManager from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import ERC20TokenStakingManager from '@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json';
import { formatEther } from 'viem';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';

type TokenType = 'native' | 'erc20';

interface CompleteDelegatorRemovalProps {
    delegationID: string;
    stakingManagerAddress: string;
    tokenType: TokenType;
    onSuccess: (data: { txHash: string; message: string }) => void;
    onError: (message: string) => void;
}

const CompleteDelegatorRemoval: React.FC<CompleteDelegatorRemovalProps> = ({
    delegationID,
    stakingManagerAddress,
    tokenType,
    onSuccess,
    onError,
}) => {
    const { coreWalletClient, publicClient, walletEVMAddress } = useWalletStore();
    const viemChain = useViemChainStore();
    const { notify } = useConsoleNotifications();

    const [messageIndex, setMessageIndex] = useState<string>('0');
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setErrorState] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [rewardInfo, setRewardInfo] = useState<{
        stakeReturned: string;
        rewardsDistributed: boolean;
    } | null>(null);

    const contractAbi = tokenType === 'native' ? NativeTokenStakingManager.abi : ERC20TokenStakingManager.abi;
    const tokenLabel = tokenType === 'native' ? 'Native Token' : 'ERC20 Token';

    const handleCompleteRemoval = async () => {
        setErrorState(null);
        setTxHash(null);
        setRewardInfo(null);

        if (!coreWalletClient || !publicClient || !viemChain) {
            setErrorState("Wallet or chain configuration is not properly initialized.");
            onError("Wallet or chain configuration is not properly initialized.");
            return;
        }

        if (!delegationID || delegationID === '0x0000000000000000000000000000000000000000000000000000000000000000') {
            setErrorState("Valid delegation ID is required.");
            onError("Valid delegation ID is required.");
            return;
        }

        if (!stakingManagerAddress) {
            setErrorState("Staking Manager address is required.");
            onError("Staking Manager address is required.");
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
            // Get delegation info before removal to show stake amount
            let delegationWeight = '0';
            try {
                const delegatorInfo = await publicClient.readContract({
                    address: stakingManagerAddress as `0x${string}`,
                    abi: contractAbi,
                    functionName: 'getDelegator',
                    args: [delegationID as `0x${string}`],
                }) as any;

                delegationWeight = delegatorInfo.weight?.toString() || '0';
            } catch (err) {
                console.warn('Could not fetch delegation info before removal:', err);
            }

            // Call completeDelegatorRemoval with both delegationID and messageIndex
            const writePromise = coreWalletClient.writeContract({
                address: stakingManagerAddress as `0x${string}`,
                abi: contractAbi,
                functionName: "completeDelegatorRemoval",
                args: [delegationID as `0x${string}`, msgIndex],
                account: walletEVMAddress as `0x${string}`,
                chain: viemChain,
            });

            notify({
                type: 'call',
                name: 'Complete Delegator Removal'
            }, writePromise, viemChain ?? undefined);

            const hash = await writePromise;
            setTxHash(hash);

            // Wait for confirmation
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            if (receipt.status !== 'success') {
                throw new Error(`Transaction failed with status: ${receipt.status}`);
            }

            // Check for DelegatorRemovalCompleted event
            const hasRemovalEvent = receipt.logs.some(log =>
                log.topics[0]?.toLowerCase().includes('delegat') &&
                (log.topics[0]?.toLowerCase().includes('removal') ||
                 log.topics[0]?.toLowerCase().includes('complete'))
            );

            setRewardInfo({
                stakeReturned: delegationWeight,
                rewardsDistributed: hasRemovalEvent,
            });

            const successMsg = hasRemovalEvent
                ? 'Delegation removal completed and rewards distributed successfully (minus delegation fees).'
                : 'Delegation removal completed successfully.';

            onSuccess({
                txHash: hash,
                message: successMsg
            });
        } catch (err: any) {
            let message = err instanceof Error ? err.message : String(err);

            // Provide more helpful error messages
            if (message.includes('User rejected')) {
                message = 'Transaction was rejected by user';
            } else if (message.includes('InvalidDelegationID')) {
                message = 'Invalid delegation ID. The delegation may not exist or removal was not initiated.';
            } else if (message.includes('DelegatorNotRemovable')) {
                message = 'Delegator cannot be removed yet. Ensure you have initiated removal first.';
            } else if (message.includes('InvalidDelegatorStatus')) {
                message = 'Delegation is not in the correct status for completion. Check if removal was initiated.';
            }

            setErrorState(`Failed to complete delegator removal: ${message}`);
            onError(`Failed to complete delegator removal: ${message}`);
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
                    <div className="text-sm text-zinc-600 dark:text-zinc-400">
                        <p><strong>Delegation ID:</strong> {delegationID}</p>
                    </div>

                    <Input
                        label="Message Index"
                        value={messageIndex}
                        onChange={setMessageIndex}
                        type="number"
                        min="0"
                        placeholder="0"
                        disabled={isProcessing}
                        helperText="Index of the warp message (should match the one used in initiate removal, usually 0)"
                    />
                </div>
            </div>

            <Alert variant="info">
                <p className="text-sm">
                    <strong>What happens when you complete removal:</strong>
                </p>
                <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                    <li>Your delegated stake will be returned</li>
                    <li>Rewards will be calculated and distributed based on validator uptime</li>
                    <li>Delegation fees will be deducted from your rewards</li>
                    <li>The validator's weight will be updated to remove your delegation</li>
                </ul>
            </Alert>

            <Button
                onClick={handleCompleteRemoval}
                disabled={isProcessing || !!txHash}
                loading={isProcessing}
            >
                {isProcessing ? 'Processing...' : 'Complete Delegator Removal & Receive Rewards'}
            </Button>

            {txHash && (
                <>
                    <Success
                        label="Transaction Hash"
                        value={txHash}
                    />
                    {rewardInfo && rewardInfo.rewardsDistributed && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                            <p className="text-sm text-green-800 dark:text-green-200">
                                <strong>Success!</strong> Delegation has been removed and rewards have been distributed.
                            </p>
                            {rewardInfo.stakeReturned !== '0' && (
                                <p className="text-sm text-green-800 dark:text-green-200 mt-1">
                                    <strong>Stake Returned:</strong> {rewardInfo.stakeReturned} (weight units)
                                </p>
                            )}
                        </div>
                    )}
                </>
            )}

            <Alert variant="warning">
                <p className="text-sm">
                    <strong>Note:</strong> Delegation fees are deducted from your rewards before distribution.
                    These fees go to the validator you delegated to and can be claimed separately by the validator.
                </p>
            </Alert>
        </div>
    );
};

export default CompleteDelegatorRemoval;
