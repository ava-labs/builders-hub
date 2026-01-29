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
import { parseEther, formatEther } from 'viem';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';

type TokenType = 'native' | 'erc20';

interface InitiateValidatorRegistrationProps {
    nodeID: string;
    blsPublicKey: string;
    stakingManagerAddress: string;
    tokenType: TokenType;
    erc20TokenAddress?: string;
    onSuccess: (data: { txHash: string; validationID: string }) => void;
    onError: (message: string) => void;
}

const InitiateValidatorRegistration: React.FC<InitiateValidatorRegistrationProps> = ({
    nodeID,
    blsPublicKey,
    stakingManagerAddress,
    tokenType,
    erc20TokenAddress,
    onSuccess,
    onError,
}) => {
    const { coreWalletClient, publicClient, walletEVMAddress } = useWalletStore();
    const viemChain = useViemChainStore();
    const { notify } = useConsoleNotifications();

    const [stakeAmount, setStakeAmount] = useState<string>('');
    const [delegationFeeBips, setDelegationFeeBips] = useState<string>('100'); // 1% default
    const [minStakeDuration, setMinStakeDuration] = useState<string>('86400'); // 1 day default
    const [remainingBalanceOwner, setRemainingBalanceOwner] = useState<string>('');
    const [disableOwner, setDisableOwner] = useState<string>('');

    const [isProcessing, setIsProcessing] = useState(false);
    const [isApproving, setIsApproving] = useState(false);
    const [error, setErrorState] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [validationID, setValidationID] = useState<string | null>(null);

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
            const amountWei = parseEther(stakeAmount);

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

    const handleInitiateRegistration = async () => {
        setErrorState(null);
        setTxHash(null);
        setValidationID(null);

        if (!coreWalletClient || !publicClient || !viemChain) {
            setErrorState("Wallet or chain configuration is not properly initialized.");
            onError("Wallet or chain configuration is not properly initialized.");
            return;
        }

        if (!nodeID || !blsPublicKey) {
            setErrorState("Node ID and BLS Public Key are required.");
            onError("Node ID and BLS Public Key are required.");
            return;
        }

        if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
            setErrorState("Valid stake amount is required.");
            onError("Valid stake amount is required.");
            return;
        }

        if (!stakingManagerAddress) {
            setErrorState("Staking Manager address is required.");
            onError("Staking Manager address is required.");
            return;
        }

        const feeBips = parseInt(delegationFeeBips);
        if (isNaN(feeBips) || feeBips < 0 || feeBips > 10000) {
            setErrorState("Delegation fee must be between 0 and 10000 basis points (0-100%).");
            onError("Delegation fee must be between 0 and 10000 basis points (0-100%).");
            return;
        }

        const duration = parseInt(minStakeDuration);
        if (isNaN(duration) || duration < 0) {
            setErrorState("Minimum stake duration must be a positive number.");
            onError("Minimum stake duration must be a positive number.");
            return;
        }

        setIsProcessing(true);
        try {
            const amountWei = parseEther(stakeAmount);

            // Build PChainOwner structs
            const remainingOwner = remainingBalanceOwner || walletEVMAddress || '';
            const disableOwnerAddr = disableOwner || walletEVMAddress || '';

            const remainingBalanceOwnerStruct = {
                threshold: 1,
                addresses: [remainingOwner as `0x${string}`],
            };

            const disableOwnerStruct = {
                threshold: 1,
                addresses: [disableOwnerAddr as `0x${string}`],
            };

            const args = [
                nodeID as `0x${string}`,
                blsPublicKey as `0x${string}`,
                remainingBalanceOwnerStruct,
                disableOwnerStruct,
                feeBips,
                duration,
            ];

            // For native token, send value. For ERC20, no value but tokens must be approved
            const txConfig: any = {
                address: stakingManagerAddress as `0x${string}`,
                abi: contractAbi,
                functionName: "initiateValidatorRegistration",
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
                name: 'Initiate Validator Registration'
            }, writePromise, viemChain ?? undefined);

            const hash = await writePromise;
            setTxHash(hash);

            // Wait for confirmation
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            if (receipt.status !== 'success') {
                throw new Error(`Transaction failed with status: ${receipt.status}`);
            }

            // Try to extract validationID from logs
            let extractedValidationID: string | null = null;
            try {
                const validationIDTopic = receipt.logs.find(log =>
                    log.topics[0]?.toLowerCase().includes('validation')
                );
                if (validationIDTopic && validationIDTopic.topics[1]) {
                    extractedValidationID = validationIDTopic.topics[1];
                    setValidationID(extractedValidationID);
                }
            } catch (err) {
                console.warn('Could not extract validation ID from logs:', err);
            }

            onSuccess({
                txHash: hash,
                validationID: extractedValidationID || 'Check transaction logs'
            });
        } catch (err: any) {
            let message = err instanceof Error ? err.message : String(err);

            // Provide more helpful error messages
            if (message.includes('User rejected')) {
                message = 'Transaction was rejected by user';
            } else if (message.includes('insufficient funds')) {
                message = `Insufficient ${tokenLabel.toLowerCase()} balance for staking`;
            } else if (message.includes('ERC20: insufficient allowance')) {
                message = 'Insufficient ERC20 allowance. Please approve tokens first.';
            }

            setErrorState(`Failed to initiate validator registration: ${message}`);
            onError(`Failed to initiate validator registration: ${message}`);
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
                    Validator Registration ({tokenLabel} Staking)
                </h3>

                <div className="space-y-3">
                    <Input
                        label="Stake Amount"
                        value={stakeAmount}
                        onChange={setStakeAmount}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="1000"
                        disabled={isProcessing || isApproving}
                        helperText={`Amount of ${tokenLabel.toLowerCase()}s to stake`}
                    />

                    <Input
                        label="Delegation Fee (Basis Points)"
                        value={delegationFeeBips}
                        onChange={setDelegationFeeBips}
                        type="number"
                        min="0"
                        max="10000"
                        placeholder="100"
                        disabled={isProcessing || isApproving}
                        helperText="Fee charged to delegators (100 = 1%, 10000 = 100%)"
                    />

                    <Input
                        label="Minimum Stake Duration (seconds)"
                        value={minStakeDuration}
                        onChange={setMinStakeDuration}
                        type="number"
                        min="0"
                        placeholder="86400"
                        disabled={isProcessing || isApproving}
                        helperText="Minimum time validators must stake (86400 = 1 day)"
                    />

                    <Input
                        label="Remaining Balance Owner (optional)"
                        value={remainingBalanceOwner}
                        onChange={setRemainingBalanceOwner}
                        placeholder={walletEVMAddress || "0x..."}
                        disabled={isProcessing || isApproving}
                        helperText="Address to receive remaining balance (defaults to your address)"
                    />

                    <Input
                        label="Disable Owner (optional)"
                        value={disableOwner}
                        onChange={setDisableOwner}
                        placeholder={walletEVMAddress || "0x..."}
                        disabled={isProcessing || isApproving}
                        helperText="Address that can disable the validator (defaults to your address)"
                    />
                </div>
            </div>

            <Alert variant="info">
                <p className="text-sm">
                    <strong>Next Steps After Registration:</strong>
                </p>
                <ul className="list-disc list-inside text-sm mt-2 space-y-1">
                    <li>After initiating registration, you'll receive a validation ID</li>
                    <li>You'll need to submit a P-Chain transaction to register the validator</li>
                    <li>Once the P-Chain accepts the validator, complete the registration</li>
                    <li>Your staked {tokenLabel.toLowerCase()}s will be locked until you remove the validator</li>
                </ul>
            </Alert>

            {!isNative && erc20TokenAddress && (
                <div className="space-y-2">
                    <Alert variant="warning">
                        <p className="text-sm">
                            <strong>ERC20 Token Approval Required:</strong> You must approve the staking manager to spend your tokens before registering.
                        </p>
                    </Alert>
                    <Button
                        onClick={handleApproveERC20}
                        disabled={isApproving || isProcessing || !stakeAmount}
                        loading={isApproving}
                        variant="secondary"
                    >
                        {isApproving ? 'Approving...' : `Approve ${stakeAmount || '0'} Tokens`}
                    </Button>
                </div>
            )}

            <Button
                onClick={handleInitiateRegistration}
                disabled={
                    isProcessing ||
                    isApproving ||
                    !stakeAmount ||
                    !!txHash
                }
                loading={isProcessing}
            >
                {isProcessing ? 'Processing...' : 'Initiate Validator Registration'}
            </Button>

            {txHash && (
                <>
                    <Success
                        label="Transaction Hash"
                        value={txHash}
                    />
                    {validationID && (
                        <Success
                            label="Validation ID"
                            value={validationID}
                        />
                    )}
                </>
            )}
        </div>
    );
};

export default InitiateValidatorRegistration;
