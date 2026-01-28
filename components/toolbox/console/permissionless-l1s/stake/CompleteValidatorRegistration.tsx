import React, { useState } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Success } from '@/components/toolbox/components/Success';
import { Alert } from '@/components/toolbox/components/Alert';
import NativeTokenStakingManager from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import ERC20TokenStakingManager from '@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';

type TokenType = 'native' | 'erc20';

interface CompleteValidatorRegistrationProps {
    validationID?: string;
    stakingManagerAddress: string;
    tokenType: TokenType;
    onSuccess: (data: { txHash: string; message: string }) => void;
    onError: (message: string) => void;
}

const CompleteValidatorRegistration: React.FC<CompleteValidatorRegistrationProps> = ({
    validationID,
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
    const [registrationComplete, setRegistrationComplete] = useState(false);

    const contractAbi = tokenType === 'native' ? NativeTokenStakingManager.abi : ERC20TokenStakingManager.abi;
    const tokenLabel = tokenType === 'native' ? 'Native Token' : 'ERC20 Token';

    const handleCompleteRegistration = async () => {
        setErrorState(null);
        setTxHash(null);
        setRegistrationComplete(false);

        if (!coreWalletClient || !publicClient || !viemChain) {
            setErrorState("Wallet or chain configuration is not properly initialized.");
            onError("Wallet or chain configuration is not properly initialized.");
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
            // Call completeValidatorRegistration with messageIndex
            const writePromise = coreWalletClient.writeContract({
                address: stakingManagerAddress as `0x${string}`,
                abi: contractAbi,
                functionName: "completeValidatorRegistration",
                args: [msgIndex],
                account: walletEVMAddress as `0x${string}`,
                chain: viemChain,
            });

            notify({
                type: 'call',
                name: 'Complete Validator Registration'
            }, writePromise, viemChain ?? undefined);

            const hash = await writePromise;
            setTxHash(hash);

            // Wait for confirmation
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            if (receipt.status !== 'success') {
                throw new Error(`Transaction failed with status: ${receipt.status}`);
            }

            // Check for ValidatorRegistrationCompleted event
            const hasCompletionEvent = receipt.logs.some(log =>
                log.topics[0]?.toLowerCase().includes('validat') &&
                (log.topics[0]?.toLowerCase().includes('registration') ||
                 log.topics[0]?.toLowerCase().includes('complete'))
            );

            if (hasCompletionEvent) {
                setRegistrationComplete(true);
            }

            const successMsg = hasCompletionEvent
                ? 'Validator registration completed successfully. Your validator is now active!'
                : 'Validator registration completed.';

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
                message = 'Invalid validation ID. The validator may not have been registered on the P-Chain yet.';
            } else if (message.includes('InvalidWarpMessage')) {
                message = 'Invalid warp message. Ensure the P-Chain transaction was successful and wait for confirmation.';
            } else if (message.includes('ValidatorAlreadyRegistered')) {
                message = 'This validator has already been registered.';
            }

            setErrorState(`Failed to complete validator registration: ${message}`);
            onError(`Failed to complete validator registration: ${message}`);
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
                    Complete Registration ({tokenLabel} Staking)
                </h3>

                <div className="space-y-3">
                    {validationID && (
                        <div className="text-sm text-zinc-600 dark:text-zinc-400">
                            <p><strong>Validation ID:</strong> {validationID}</p>
                        </div>
                    )}

                    <Input
                        label="Message Index"
                        value={messageIndex}
                        onChange={setMessageIndex}
                        type="number"
                        min="0"
                        placeholder="0"
                        disabled={isProcessing}
                        helperText="Index of the warp message from P-Chain registration (usually 0)"
                    />
                </div>
            </div>

            <Alert variant="info">
                <p className="text-sm">
                    <strong>Before completing registration:</strong>
                </p>
                <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                    <li>Ensure the P-Chain validator registration transaction has been confirmed</li>
                    <li>The warp message from the P-Chain must be available</li>
                    <li>Once completed, your validator will be active on the L1</li>
                    <li>Your staked {tokenLabel.toLowerCase()}s will be locked until removal</li>
                </ul>
            </Alert>

            <Button
                onClick={handleCompleteRegistration}
                disabled={isProcessing || !!txHash}
                loading={isProcessing}
            >
                {isProcessing ? 'Processing...' : 'Complete Validator Registration'}
            </Button>

            {txHash && (
                <>
                    <Success
                        label="Transaction Hash"
                        value={txHash}
                    />
                    {registrationComplete && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-md">
                            <p className="text-sm text-green-800 dark:text-green-200">
                                <strong>Success!</strong> Your validator is now registered and active on the L1.
                                You can now accept delegations from other users.
                            </p>
                        </div>
                    )}
                </>
            )}

            <Alert variant="warning">
                <p className="text-sm">
                    <strong>Important:</strong> After completing registration, submit the P-Chain transaction
                    to actually activate the validator on the network. The completion transaction only updates
                    the staking manager contract state.
                </p>
            </Alert>
        </div>
    );
};

export default CompleteValidatorRegistration;
