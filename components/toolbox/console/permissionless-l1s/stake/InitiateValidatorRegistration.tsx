import React, { useState, useEffect } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { Success } from '@/components/toolbox/components/Success';
import { Alert } from '@/components/toolbox/components/Alert';
import { parseNodeID, parsePChainAddress } from '@/components/toolbox/coreViem/utils/ids';
import NativeTokenStakingManager from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import ERC20TokenStakingManager from '@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json';
import ExampleERC20 from '@/contracts/icm-contracts/compiled/ExampleERC20.json';
import { parseEther, formatEther } from 'viem';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';

interface ContractSettings {
    minimumStakeAmount: string;
    maximumStakeAmount: string;
    minimumStakeDuration: string;
    minimumDelegationFeeBips: number;
}

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
    const { coreWalletClient, publicClient, walletEVMAddress, pChainAddress } = useWalletStore();
    const viemChain = useViemChainStore();
    const { notify } = useConsoleNotifications();

    const [stakeAmount, setStakeAmount] = useState<string>('');
    const [delegationFeeBips, setDelegationFeeBips] = useState<string>('100'); // 1% default
    const [minStakeDuration, setMinStakeDuration] = useState<string>('86400'); // 1 day default
    // P-Chain addresses in bech32 format (e.g., P-avax1... or P-fuji1...)
    const [remainingBalanceOwner, setRemainingBalanceOwner] = useState<string>('');
    const [disableOwner, setDisableOwner] = useState<string>('');

    const [isProcessing, setIsProcessing] = useState(false);
    const [isApproving, setIsApproving] = useState(false);
    const [error, setErrorState] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [validationID, setValidationID] = useState<string | null>(null);
    const [contractSettings, setContractSettings] = useState<ContractSettings | null>(null);
    const [settingsError, setSettingsError] = useState<string | null>(null);

    const contractAbi = tokenType === 'native' ? NativeTokenStakingManager.abi : ERC20TokenStakingManager.abi;
    const tokenLabel = tokenType === 'native' ? 'Native Token' : 'ERC20 Token';
    const isNative = tokenType === 'native';

    // Fetch contract settings to help with debugging
    useEffect(() => {
        const fetchSettings = async () => {
            if (!publicClient || !stakingManagerAddress) return;
            
            try {
                // Use getStakingManagerSettings which returns all settings in one call
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
                    maximumStakeMultiplier: number;
                    weightToValueFactor: bigint;
                    rewardCalculator: string;
                    uptimeBlockchainID: string;
                };
                
                setContractSettings({
                    minimumStakeAmount: formatEther(settings.minimumStakeAmount),
                    maximumStakeAmount: formatEther(settings.maximumStakeAmount),
                    minimumStakeDuration: String(settings.minimumStakeDuration),
                    minimumDelegationFeeBips: Number(settings.minimumDelegationFeeBips),
                });
                setSettingsError(null);
            } catch (err: any) {
                console.error('Failed to fetch contract settings:', err);
                setSettingsError(`Failed to read contract settings: ${err.message || 'Unknown error'}. The staking manager may not be initialized.`);
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

        // Validate against contract settings if available
        if (contractSettings) {
            const stakeAmountNum = parseFloat(stakeAmount);
            const minStakeNum = parseFloat(contractSettings.minimumStakeAmount);
            const maxStakeNum = parseFloat(contractSettings.maximumStakeAmount);
            
            if (stakeAmountNum < minStakeNum) {
                const msg = `Stake amount (${stakeAmount}) is below minimum (${contractSettings.minimumStakeAmount})`;
                setErrorState(msg);
                onError(msg);
                return;
            }
            
            if (stakeAmountNum > maxStakeNum) {
                const msg = `Stake amount (${stakeAmount}) exceeds maximum (${contractSettings.maximumStakeAmount})`;
                setErrorState(msg);
                onError(msg);
                return;
            }
            
            if (feeBips < contractSettings.minimumDelegationFeeBips) {
                const msg = `Delegation fee (${feeBips} bips) is below minimum (${contractSettings.minimumDelegationFeeBips} bips)`;
                setErrorState(msg);
                onError(msg);
                return;
            }
            
            const minDurationNum = parseInt(contractSettings.minimumStakeDuration);
            if (duration < minDurationNum) {
                const msg = `Stake duration (${duration}s) is below minimum (${contractSettings.minimumStakeDuration}s)`;
                setErrorState(msg);
                onError(msg);
                return;
            }
        }

        setIsProcessing(true);
        try {
            const amountWei = parseEther(stakeAmount);

            // Build PChainOwner structs - addresses must be P-Chain format (bech32)
            // Use the connected wallet's P-Chain address as default
            const remainingOwnerAddress = remainingBalanceOwner || pChainAddress || '';
            const disableOwnerAddress = disableOwner || pChainAddress || '';

            if (!remainingOwnerAddress) {
                throw new Error('Remaining Balance Owner is required. Please connect a wallet with P-Chain access or enter a P-Chain address.');
            }
            if (!disableOwnerAddress) {
                throw new Error('Disable Owner is required. Please connect a wallet with P-Chain access or enter a P-Chain address.');
            }

            // Convert P-Chain addresses from bech32 to hex
            const remainingBalanceOwnerStruct = {
                threshold: 1,
                addresses: [parsePChainAddress(remainingOwnerAddress)],
            };

            const disableOwnerStruct = {
                threshold: 1,
                addresses: [parsePChainAddress(disableOwnerAddress)],
            };

            // Build args based on token type
            // NativeTokenStakingManager: (bytes nodeID, bytes blsPublicKey, PChainOwner remainingBalanceOwner, PChainOwner disableOwner, uint16 delegationFeeBips, uint64 minStakeDuration, address rewardRecipient)
            // ERC20TokenStakingManager: (bytes nodeID, bytes blsPublicKey, PChainOwner remainingBalanceOwner, PChainOwner disableOwner, uint16 delegationFeeBips, uint64 minStakeDuration, uint256 stakeAmount, address token)
            
            const rewardRecipient = walletEVMAddress as `0x${string}`;
            
            // Convert NodeID from CB58 format to hex bytes
            const nodeIDBytes = parseNodeID(nodeID);
            
            const args = isNative
                ? [
                    nodeIDBytes as `0x${string}`,
                    blsPublicKey as `0x${string}`,
                    remainingBalanceOwnerStruct,
                    disableOwnerStruct,
                    feeBips,
                    BigInt(duration),
                    rewardRecipient,
                ]
                : [
                    nodeIDBytes as `0x${string}`,
                    blsPublicKey as `0x${string}`,
                    remainingBalanceOwnerStruct,
                    disableOwnerStruct,
                    feeBips,
                    BigInt(duration),
                    amountWei,
                    erc20TokenAddress as `0x${string}`,
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

            // Estimate gas first to catch revert reasons early
            try {
                const gasEstimate = await publicClient.estimateContractGas(txConfig);
                txConfig.gas = gasEstimate + (gasEstimate * 20n / 100n); // Add 20% buffer
            } catch (gasError: any) {
                console.error('Gas estimation failed:', gasError);
                const gasMessage = gasError instanceof Error ? gasError.message : String(gasError);
                
                // Try to extract the actual revert reason
                if (gasMessage.includes('execution reverted')) {
                    throw new Error(`Contract reverted: ${gasMessage}. Check that the staking manager is initialized and you have sufficient balance.`);
                } else if (gasMessage.includes('insufficient funds')) {
                    throw new Error(`Insufficient balance: You need at least ${stakeAmount} ${isNative ? 'native tokens' : 'ERC20 tokens'} plus gas fees.`);
                }
                throw new Error(`Gas estimation failed: ${gasMessage}`);
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

            {settingsError && (
                <Alert variant="warning">
                    {settingsError}
                </Alert>
            )}

            {contractSettings && (
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                    <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                        Staking Manager Requirements
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                            <span className="text-blue-600 dark:text-blue-400">Min Stake:</span>{' '}
                            <span className="font-mono text-blue-900 dark:text-blue-100">{contractSettings.minimumStakeAmount} tokens</span>
                        </div>
                        <div>
                            <span className="text-blue-600 dark:text-blue-400">Max Stake:</span>{' '}
                            <span className="font-mono text-blue-900 dark:text-blue-100">{contractSettings.maximumStakeAmount} tokens</span>
                        </div>
                        <div>
                            <span className="text-blue-600 dark:text-blue-400">Min Duration:</span>{' '}
                            <span className="font-mono text-blue-900 dark:text-blue-100">{contractSettings.minimumStakeDuration} seconds</span>
                        </div>
                        <div>
                            <span className="text-blue-600 dark:text-blue-400">Min Delegation Fee:</span>{' '}
                            <span className="font-mono text-blue-900 dark:text-blue-100">{contractSettings.minimumDelegationFeeBips} bips ({contractSettings.minimumDelegationFeeBips / 100}%)</span>
                        </div>
                    </div>
                </div>
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
                        placeholder={contractSettings?.minimumStakeAmount || "1000"}
                        disabled={isProcessing || isApproving}
                        helperText={contractSettings 
                            ? `Required: ${contractSettings.minimumStakeAmount} - ${contractSettings.maximumStakeAmount} tokens`
                            : `Amount of ${tokenLabel.toLowerCase()}s to stake`}
                    />

                    <Input
                        label="Delegation Fee (Basis Points)"
                        value={delegationFeeBips}
                        onChange={setDelegationFeeBips}
                        type="number"
                        min="0"
                        max="10000"
                        placeholder={contractSettings?.minimumDelegationFeeBips?.toString() || "100"}
                        disabled={isProcessing || isApproving}
                        helperText={contractSettings 
                            ? `Minimum: ${contractSettings.minimumDelegationFeeBips} bips (${contractSettings.minimumDelegationFeeBips / 100}%)`
                            : "Fee charged to delegators (100 = 1%, 10000 = 100%)"}
                    />

                    <Input
                        label="Minimum Stake Duration (seconds)"
                        value={minStakeDuration}
                        onChange={setMinStakeDuration}
                        type="number"
                        min="0"
                        placeholder={contractSettings?.minimumStakeDuration || "86400"}
                        disabled={isProcessing || isApproving}
                        helperText={contractSettings 
                            ? `Minimum: ${contractSettings.minimumStakeDuration} seconds`
                            : "Minimum time validators must stake (86400 = 1 day)"}
                    />

                    <div className="space-y-2">
                        <Input
                            label="Remaining Balance Owner (P-Chain Address)"
                            value={remainingBalanceOwner}
                            onChange={setRemainingBalanceOwner}
                            placeholder={pChainAddress || "P-avax1... or P-fuji1..."}
                            disabled={isProcessing || isApproving}
                            helperText="P-Chain address to receive remaining balance. Use bech32 format (e.g., P-avax1... or P-fuji1...)"
                        />
                        <Button
                            onClick={() => pChainAddress && setRemainingBalanceOwner(pChainAddress)}
                            disabled={!pChainAddress || remainingBalanceOwner === pChainAddress || isProcessing || isApproving}
                            variant="secondary"
                            size="sm"
                            className="w-full"
                        >
                            Use Connected P-Chain Address
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <Input
                            label="Disable Owner (P-Chain Address)"
                            value={disableOwner}
                            onChange={setDisableOwner}
                            placeholder={pChainAddress || "P-avax1... or P-fuji1..."}
                            disabled={isProcessing || isApproving}
                            helperText="P-Chain address that can disable the validator. Use bech32 format (e.g., P-avax1... or P-fuji1...)"
                        />
                        <Button
                            onClick={() => pChainAddress && setDisableOwner(pChainAddress)}
                            disabled={!pChainAddress || disableOwner === pChainAddress || isProcessing || isApproving}
                            variant="secondary"
                            size="sm"
                            className="w-full"
                        >
                            Use Connected P-Chain Address
                        </Button>
                    </div>
                </div>
            </div>

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
