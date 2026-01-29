import React, { useState, useEffect } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Success } from '@/components/toolbox/components/Success';
import { Alert } from '@/components/toolbox/components/Alert';
import NativeTokenStakingManager from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import ERC20TokenStakingManager from '@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { parseEther, formatEther, decodeEventLog } from 'viem';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';

type TokenType = 'native' | 'erc20';

interface ContractSettings {
    minimumStakeAmount: string;
    maximumStakeAmount: string;
}

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
    const [contractSettings, setContractSettings] = useState<ContractSettings | null>(null);
    const [settingsError, setSettingsError] = useState<string | null>(null);

    const contractAbi = tokenType === 'native' ? NativeTokenStakingManager.abi : ERC20TokenStakingManager.abi;
    const tokenLabel = tokenType === 'native' ? 'Native Token' : 'ERC20 Token';
    const isNative = tokenType === 'native';

    // Fetch contract settings to show minimum delegation amount
    useEffect(() => {
        const fetchSettings = async () => {
            if (!publicClient || !stakingManagerAddress) return;
            
            try {
                const settings = await publicClient.readContract({
                    address: stakingManagerAddress as `0x${string}`,
                    abi: contractAbi,
                    functionName: 'getStakingManagerSettings',
                }) as {
                    manager: string;
                    minimumStakeAmount: bigint;
                    maximumStakeAmount: bigint;
                    minimumStakeDuration: bigint;
                    minimumDelegationFeeBips: number;
                    maximumDelegationFeeBips: number;
                    rewardCalculator: string;
                    uptimeBlockchainID: string;
                };

                setContractSettings({
                    minimumStakeAmount: formatEther(settings.minimumStakeAmount),
                    maximumStakeAmount: formatEther(settings.maximumStakeAmount),
                });
                setSettingsError(null);
            } catch (err: any) {
                console.warn("Failed to fetch contract settings:", err);
                setSettingsError("Could not fetch delegation requirements. Proceed with caution.");
            }
        };

        fetchSettings();
    }, [publicClient, stakingManagerAddress, contractAbi]);

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

            // Pre-transaction validation: Check validator status and PoS eligibility
            try {
                // Get the underlying ValidatorManager address from StakingManager settings
                const settings = await publicClient.readContract({
                    address: stakingManagerAddress as `0x${string}`,
                    abi: contractAbi,
                    functionName: 'getStakingManagerSettings',
                }) as { manager: string };

                const validatorManagerAbi = [
                    {
                        "name": "getValidator",
                        "type": "function",
                        "stateMutability": "view",
                        "inputs": [{ "name": "validationID", "type": "bytes32" }],
                        "outputs": [{
                            "name": "",
                            "type": "tuple",
                            "components": [
                                { "name": "status", "type": "uint8" },
                                { "name": "nodeID", "type": "bytes" },
                                { "name": "startingWeight", "type": "uint64" },
                                { "name": "messageNonce", "type": "uint64" },
                                { "name": "weight", "type": "uint64" },
                                { "name": "startedAt", "type": "uint64" },
                                { "name": "endedAt", "type": "uint64" }
                            ]
                        }]
                    }
                ];

                // Check if validator exists and get its status
                const validator = await publicClient.readContract({
                    address: settings.manager as `0x${string}`,
                    abi: validatorManagerAbi,
                    functionName: 'getValidator',
                    args: [validationID as `0x${string}`]
                }) as { status: number };
                
                // Status enum: 0=Unknown, 1=PendingAdded, 2=Active, 3=PendingRemoved, 4=Completed, 5=Invalidated
                if (validator.status === 0) {
                    throw new Error('Validator not found. Please verify the validation ID is correct.');
                } else if (validator.status === 1) {
                    throw new Error('Validator registration is still pending. Please complete the validator registration first (Step 6 of staking flow).');
                } else if (validator.status !== 2) {
                    const statusNames = ['Unknown', 'PendingAdded', 'Active', 'PendingRemoved', 'Completed', 'Invalidated'];
                    throw new Error(`Validator is not active. Current status: ${statusNames[validator.status] || validator.status}. Only active validators can receive delegations.`);
                }

                // Check if this is a PoS validator
                const posValidator = await publicClient.readContract({
                    address: stakingManagerAddress as `0x${string}`,
                    abi: contractAbi,
                    functionName: 'getStakingValidator',
                    args: [validationID as `0x${string}`]
                }) as { owner: string };
                
                if (posValidator.owner === '0x0000000000000000000000000000000000000000') {
                    throw new Error('This validator is not a PoS (Proof-of-Stake) validator. It may be a PoA validator that cannot receive delegations.');
                }

                // Check if delegation amount is within bounds
                if (contractSettings) {
                    const minAmount = parseEther(contractSettings.minimumStakeAmount);
                    const maxAmount = parseEther(contractSettings.maximumStakeAmount);
                    
                    if (amountWei < minAmount) {
                        throw new Error(`Delegation amount (${delegationAmount}) is below the minimum required (${contractSettings.minimumStakeAmount}).`);
                    }
                    if (amountWei > maxAmount) {
                        throw new Error(`Delegation amount (${delegationAmount}) exceeds the maximum allowed (${contractSettings.maximumStakeAmount}).`);
                    }
                }
            } catch (preCheckErr: any) {
                // If it's one of our custom errors, throw it directly
                if (preCheckErr.message && !preCheckErr.message.includes('reverted')) {
                    throw preCheckErr;
                }
                // Otherwise, continue - the gas estimation will catch the actual error
            }

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

            // Estimate gas first to catch revert reasons early
            try {
                const gasEstimate = await publicClient.estimateContractGas(txConfig);
                txConfig.gas = gasEstimate + (gasEstimate * 20n / 100n); // Add 20% buffer
            } catch (gasError: any) {
                const gasMessage = gasError instanceof Error ? gasError.message : String(gasError);
                
                // Check for specific custom errors from the contract
                if (gasMessage.includes('InvalidValidationID')) {
                    throw new Error('Invalid validation ID. The validator may not be registered or active.');
                } else if (gasMessage.includes('ValidatorNotActive')) {
                    throw new Error('Validator is not active. Complete validator registration first.');
                } else if (gasMessage.includes('MaxWeightExceeded')) {
                    throw new Error('Maximum delegation weight exceeded for this validator. Try a smaller delegation amount.');
                } else if (gasMessage.includes('InvalidStakeAmount') || gasMessage.includes('MinStakeAmount')) {
                    throw new Error(`Delegation amount (${delegationAmount}) is invalid. Check minimum and maximum requirements.`);
                } else if (gasMessage.includes('InvalidRewardRecipient')) {
                    throw new Error('Invalid reward recipient address.');
                } else if (gasMessage.includes('InvalidDelegatorStatus')) {
                    throw new Error('Invalid delegator status. You may already have a pending delegation.');
                } else if (gasMessage.includes('ValidatorNotPoS')) {
                    throw new Error('This validator is not a PoS validator and cannot receive delegations.');
                } else if (gasMessage.includes('insufficient funds')) {
                    throw new Error(`Insufficient balance: You need at least ${delegationAmount} ${isNative ? 'native tokens' : 'ERC20 tokens'} plus gas fees.`);
                } else if (gasMessage.includes('execution reverted')) {
                    throw new Error(`Contract reverted. Ensure the validator is active and accepts delegations.`);
                }
                throw new Error(`Gas estimation failed: ${gasMessage}`);
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

            // Extract delegationID from InitiatedDelegatorRegistration event
            // Event: InitiatedDelegatorRegistration(bytes32 indexed delegationID, bytes32 indexed validationID, address indexed delegatorAddress, ...)
            let extractedDelegationID: string | null = null;
            try {
                const initiatedDelegatorRegistrationEvent = {
                    type: 'event' as const,
                    name: 'InitiatedDelegatorRegistration',
                    inputs: [
                        { name: 'delegationID', type: 'bytes32', indexed: true },
                        { name: 'validationID', type: 'bytes32', indexed: true },
                        { name: 'delegatorAddress', type: 'address', indexed: true },
                        { name: 'nonce', type: 'uint64', indexed: false },
                        { name: 'validatorWeight', type: 'uint64', indexed: false },
                        { name: 'delegatorWeight', type: 'uint64', indexed: false },
                        { name: 'setWeightMessageID', type: 'bytes32', indexed: false },
                    ],
                };
                
                for (const log of receipt.logs) {
                    try {
                        const decoded = decodeEventLog({
                            abi: [initiatedDelegatorRegistrationEvent],
                            data: log.data,
                            topics: log.topics,
                        });
                        
                        if (decoded.eventName === 'InitiatedDelegatorRegistration') {
                            extractedDelegationID = (decoded.args as { delegationID: string }).delegationID;
                            setDelegationID(extractedDelegationID);
                            break;
                        }
                    } catch {
                        // Not this event, continue
                    }
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

            {settingsError && (
                <Alert variant="warning">{settingsError}</Alert>
            )}

            {contractSettings && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                    <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                        Delegation Requirements
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                            <span className="text-blue-600 dark:text-blue-400">Minimum Amount:</span>
                            <span className="ml-1 font-mono">{contractSettings.minimumStakeAmount} {isNative ? 'tokens' : 'ERC20'}</span>
                        </div>
                        <div>
                            <span className="text-blue-600 dark:text-blue-400">Maximum Amount:</span>
                            <span className="ml-1 font-mono">{contractSettings.maximumStakeAmount} {isNative ? 'tokens' : 'ERC20'}</span>
                        </div>
                    </div>
                </div>
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

                    <div className="space-y-2">
                        <Input
                            label="Reward Recipient (optional)"
                            value={rewardRecipient}
                            onChange={setRewardRecipient}
                            placeholder={walletEVMAddress || "0x..."}
                            disabled={isProcessing || isApproving}
                            helperText="Address to receive delegation rewards (defaults to your address)"
                        />
                        <Button
                            onClick={() => walletEVMAddress && setRewardRecipient(walletEVMAddress)}
                            disabled={!walletEVMAddress || rewardRecipient === walletEVMAddress || isProcessing || isApproving}
                            variant="secondary"
                            size="sm"
                            className="w-full"
                        >
                            Use Connected Wallet Address
                        </Button>
                    </div>
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
