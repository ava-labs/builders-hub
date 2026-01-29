import React, { useState } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Success } from '@/components/toolbox/components/Success';
import { Alert } from '@/components/toolbox/components/Alert';
import NativeTokenStakingManager from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import ERC20TokenStakingManager from '@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { parseEther } from 'viem';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';

type TokenType = 'native' | 'erc20';

interface InitiateDelegationProps {
    validationID: string;
    stakingManagerAddress: string;
    tokenType: TokenType;
    erc20TokenAddress?: string;
    onSuccess: (data: { txHash: string; delegationID: string }) => void;
    onError: (message: string) => void;
}

const InitiateDelegation: React.FC<InitiateDelegationProps> = ({
    validationID,
    stakingManagerAddress,
    tokenType,
    erc20TokenAddress,
    onSuccess,
    onError,
}) => {
    const { coreWalletClient, publicClient, walletEVMAddress } = useWalletStore();
    const viemChain = useViemChainStore();
    const { notify } = useConsoleNotifications();

    const [delegationAmount, setDelegationAmount] = useState<string>('');
    const [rewardRecipient, setRewardRecipient] = useState<string>('');

    const [isProcessing, setIsProcessing] = useState(false);
    const [isApproving, setIsApproving] = useState(false);
    const [error, setErrorState] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [delegationID, setDelegationID] = useState<string | null>(null);

    const contractAbi = tokenType === 'native' ? NativeTokenStakingManager.abi : ERC20TokenStakingManager.abi;
    const tokenLabel = tokenType === 'native' ? 'Native Token' : 'ERC20 Token';
    const isNative = tokenType === 'native';

    const handleApproveERC20 = async () => {
        if (!erc20TokenAddress || !coreWalletClient || !publicClient || !viemChain) {
            setErrorState("ERC20 token address or wallet not available");
            return;
        }

        setIsApproving(true);
        setErrorState(null);

        try {
            const amountWei = parseEther(delegationAmount);

            const approvePromise = coreWalletClient.writeContract({
                address: erc20TokenAddress as `0x${string}`,
                abi: ExampleERC20.abi,
                functionName: 'approve',
                args: [stakingManagerAddress as `0x${string}`, amountWei],
                account: walletEVMAddress as `0x${string}`,
                chain: viemChain,
            });

            notify({
                type: 'call',
                name: 'Approve ERC20 Tokens'
            }, approvePromise, viemChain ?? undefined);

            const hash = await approvePromise;
            await publicClient.waitForTransactionReceipt({ hash });

            setErrorState(null);
        } catch (err: any) {
            const message = err instanceof Error ? err.message : String(err);
            setErrorState(`Failed to approve tokens: ${message}`);
        } finally {
            setIsApproving(false);
        }
    };

    const handleInitiateDelegation = async () => {
        setErrorState(null);
        setTxHash(null);
        setDelegationID(null);

        if (!coreWalletClient || !publicClient || !viemChain) {
            setErrorState("Wallet or chain configuration is not properly initialized.");
            onError("Wallet or chain configuration is not properly initialized.");
            return;
        }

        if (!validationID) {
            setErrorState("Validation ID is required.");
            onError("Validation ID is required.");
            return;
        }

        if (!delegationAmount || parseFloat(delegationAmount) <= 0) {
            setErrorState("Valid delegation amount is required.");
            onError("Valid delegation amount is required.");
            return;
        }

        if (!stakingManagerAddress) {
            setErrorState("Staking Manager address is required.");
            onError("Staking Manager address is required.");
            return;
        }

        setIsProcessing(true);
        try {
            const amountWei = parseEther(delegationAmount);
            const recipient = rewardRecipient || walletEVMAddress || '';

            // Build args based on token type
            // NativeTokenStakingManager: (bytes32 validationID, address rewardRecipient) payable
            // ERC20TokenStakingManager: (bytes32 validationID, uint256 delegationAmount, address rewardRecipient)
            const args = isNative
                ? [
                    validationID as `0x${string}`,
                    recipient as `0x${string}`,
                ]
                : [
                    validationID as `0x${string}`,
                    amountWei,
                    recipient as `0x${string}`,
                ];

            // For native token, send value. For ERC20, no value but tokens must be approved
            const txConfig: any = {
                address: stakingManagerAddress as `0x${string}`,
                abi: contractAbi,
                functionName: "initiateDelegatorRegistration",
                args,
                account: walletEVMAddress as `0x${string}`,
                chain: viemChain,
            };

            if (isNative) {
                txConfig.value = amountWei;
            }

            const writePromise = coreWalletClient.writeContract(txConfig);

            notify({
                type: 'call',
                name: 'Initiate Delegation'
            }, writePromise, viemChain ?? undefined);

            const hash = await writePromise;
            setTxHash(hash);

            // Wait for confirmation
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            if (receipt.status !== 'success') {
                throw new Error(`Transaction failed with status: ${receipt.status}`);
            }

            // Try to extract delegationID from logs
            let extractedDelegationID: string | null = null;
            try {
                const delegationIDTopic = receipt.logs.find(log =>
                    log.topics[0]?.toLowerCase().includes('delegation') &&
                    log.topics[0]?.toLowerCase().includes('initiat')
                );
                if (delegationIDTopic && delegationIDTopic.topics[1]) {
                    extractedDelegationID = delegationIDTopic.topics[1];
                    setDelegationID(extractedDelegationID);
                }
            } catch (err) {
                console.warn('Could not extract delegation ID from logs:', err);
            }

            onSuccess({
                txHash: hash,
                delegationID: extractedDelegationID || 'Check transaction logs'
            });
        } catch (err: any) {
            let message = err instanceof Error ? err.message : String(err);

            // Provide more helpful error messages
            if (message.includes('User rejected')) {
                message = 'Transaction was rejected by user';
            } else if (message.includes('insufficient funds')) {
                message = `Insufficient ${tokenLabel.toLowerCase()} balance for delegation`;
            } else if (message.includes('ERC20: insufficient allowance')) {
                message = 'Insufficient ERC20 allowance. Please approve tokens first.';
            } else if (message.includes('InvalidValidationID')) {
                message = 'Invalid validation ID. The validator may not be active.';
            } else if (message.includes('MinStakeDurationNotMet')) {
                message = 'Delegation amount does not meet minimum stake duration requirements.';
            }

            setErrorState(`Failed to initiate delegation: ${message}`);
            onError(`Failed to initiate delegation: ${message}`);
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
                    Delegation Registration ({tokenLabel} Staking)
                </h3>

                <div className="space-y-3">
                    {validationID && (
                        <div className="text-sm text-zinc-600 dark:text-zinc-400">
                            <p><strong>Validator ID:</strong> {validationID}</p>
                        </div>
                    )}

                    <Input
                        label="Delegation Amount"
                        value={delegationAmount}
                        onChange={setDelegationAmount}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="100"
                        disabled={isProcessing || isApproving}
                        helperText={`Amount of ${tokenLabel.toLowerCase()}s to delegate`}
                    />

                    <Input
                        label="Reward Recipient (optional)"
                        value={rewardRecipient}
                        onChange={setRewardRecipient}
                        placeholder={walletEVMAddress || "0x..."}
                        disabled={isProcessing || isApproving}
                        helperText="Address to receive delegation rewards (defaults to your address)"
                    />
                </div>
            </div>

            <Alert variant="info">
                <p className="text-sm">
                    <strong>Next Steps After Delegation:</strong>
                </p>
                <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                    <li>After initiating delegation, you'll receive a delegation ID</li>
                    <li>You'll need to submit a P-Chain transaction to update validator weight</li>
                    <li>Once the P-Chain accepts the weight change, complete the delegation</li>
                    <li>Your delegated {tokenLabel.toLowerCase()}s will be locked until removal</li>
                </ul>
            </Alert>

            {!isNative && erc20TokenAddress && (
                <div className="space-y-2">
                    <Alert variant="warning">
                        <p className="text-sm">
                            <strong>ERC20 Token Approval Required:</strong> You must approve the staking manager to spend your tokens before delegating.
                        </p>
                    </Alert>
                    <Button
                        onClick={handleApproveERC20}
                        disabled={isApproving || isProcessing || !delegationAmount}
                        loading={isApproving}
                        variant="secondary"
                    >
                        {isApproving ? 'Approving...' : `Approve ${delegationAmount || '0'} Tokens`}
                    </Button>
                </div>
            )}

            <Button
                onClick={handleInitiateDelegation}
                disabled={
                    isProcessing ||
                    isApproving ||
                    !delegationAmount ||
                    !!txHash
                }
                loading={isProcessing}
            >
                {isProcessing ? 'Processing...' : 'Initiate Delegation'}
            </Button>

            {txHash && (
                <>
                    <Success
                        label="Transaction Hash"
                        value={txHash}
                    />
                    {delegationID && (
                        <Success
                            label="Delegation ID"
                            value={delegationID}
                        />
                    )}
                </>
            )}
        </div>
    );
};

export default InitiateDelegation;
