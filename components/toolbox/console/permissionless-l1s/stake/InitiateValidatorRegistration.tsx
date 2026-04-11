import React, { useState, useEffect } from 'react';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useChainPublicClient } from '@/components/toolbox/hooks/useChainPublicClient';
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
import { useNativeTokenStakingManager, useERC20TokenStakingManager } from '@/components/toolbox/hooks/contracts';
import { useERC20Token } from '@/components/toolbox/hooks/useERC20Token';
import { useResolvedWalletClient } from '@/components/toolbox/hooks/useResolvedWalletClient';

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
    remainingBalanceOwner?: { addresses: string[]; threshold: number };
    disableOwner?: { addresses: string[]; threshold: number };
    onSuccess: (data: { txHash: string; validationID: string }) => void;
    onError: (message: string) => void;
}

const InitiateValidatorRegistration: React.FC<InitiateValidatorRegistrationProps> = ({
    nodeID,
    blsPublicKey,
    stakingManagerAddress,
    tokenType,
    erc20TokenAddress,
    remainingBalanceOwner: remainingBalanceOwnerProp,
    disableOwner: disableOwnerProp,
    onSuccess,
    onError,
}) => {
    const { walletEVMAddress, pChainAddress } = useWalletStore();
    const chainPublicClient = useChainPublicClient();
    const walletClient = useResolvedWalletClient();
    const viemChain = useViemChainStore();

    // Initialize hooks
    const nativeStakingManager = useNativeTokenStakingManager(stakingManagerAddress || null);
    const erc20StakingManager = useERC20TokenStakingManager(stakingManagerAddress || null);
    const erc20Token = useERC20Token(erc20TokenAddress || null, ExampleERC20.abi);

    const [stakeAmount, setStakeAmount] = useState<string>('');
    const [delegationFeeBips, setDelegationFeeBips] = useState<string>('100'); // 1% default
    const [minStakeDuration, setMinStakeDuration] = useState<string>('86400'); // 1 day default

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
            if (!chainPublicClient || !stakingManagerAddress) return;

            try {
                // Use getStakingManagerSettings which returns all settings in one call
                const settings = await chainPublicClient.readContract({
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
    }, [chainPublicClient, stakingManagerAddress, contractAbi]);

    const handleApproveERC20 = async () => {
        if (!erc20TokenAddress || !walletClient || !chainPublicClient || !viemChain) {
            setErrorState("ERC20 token address or wallet not available");
            return;
        }

        setIsApproving(true);
        setErrorState(null);

        try {
            const amountWei = parseEther(stakeAmount);

            const hash = await erc20Token.approve(stakingManagerAddress as `0x${string}`, amountWei.toString());
            await chainPublicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });

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

        if (!walletClient || !chainPublicClient || !viemChain) {
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

            // Build PChainOwner structs from validator details or wallet address
            const remainingOwnerAddresses = remainingBalanceOwnerProp?.addresses?.length
                ? remainingBalanceOwnerProp.addresses
                : (pChainAddress ? [pChainAddress] : []);
            const disableOwnerAddresses = disableOwnerProp?.addresses?.length
                ? disableOwnerProp.addresses
                : (pChainAddress ? [pChainAddress] : []);

            if (remainingOwnerAddresses.length === 0) {
                throw new Error('Remaining Balance Owner is required. Please add P-Chain addresses in the validator details.');
            }
            if (disableOwnerAddresses.length === 0) {
                throw new Error('Disable Owner is required. Please add P-Chain addresses in the validator details.');
            }

            // Convert P-Chain addresses from bech32 to hex
            const remainingBalanceOwnerStruct = {
                threshold: remainingBalanceOwnerProp?.threshold || 1,
                addresses: remainingOwnerAddresses.map(addr => parsePChainAddress(addr)),
            };

            const disableOwnerStruct = {
                threshold: disableOwnerProp?.threshold || 1,
                addresses: disableOwnerAddresses.map(addr => parsePChainAddress(addr)),
            };

            const rewardRecipient = walletEVMAddress as `0x${string}`;

            // Convert NodeID from CB58 format to hex bytes
            const nodeIDBytes = parseNodeID(nodeID);

            // Call the appropriate hook based on token type
            // NativeTokenStakingManager: (nodeID, blsPublicKey, remainingBalanceOwner, disableOwner, delegationFeeBips, minStakeDuration, rewardRecipient) + msg.value
            // ERC20TokenStakingManager: (nodeID, blsPublicKey, remainingBalanceOwner, disableOwner, delegationFeeBips, minStakeDuration, stakeAmount, rewardRecipient)
            let hash: string;
            if (isNative) {
                hash = await nativeStakingManager.initiateValidatorRegistration(
                    nodeIDBytes as `0x${string}`,
                    blsPublicKey as `0x${string}`,
                    remainingBalanceOwnerStruct,
                    disableOwnerStruct,
                    feeBips,
                    BigInt(duration),
                    rewardRecipient,
                    amountWei
                );
            } else {
                hash = await erc20StakingManager.initiateValidatorRegistration(
                    nodeIDBytes as `0x${string}`,
                    blsPublicKey as `0x${string}`,
                    remainingBalanceOwnerStruct,
                    disableOwnerStruct,
                    feeBips,
                    BigInt(duration),
                    amountWei,
                    rewardRecipient
                );
            }
            setTxHash(hash);

            // Wait for confirmation
            const receipt = await chainPublicClient.waitForTransactionReceipt({ hash: hash as `0x${string}` });
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
            } else if (message.includes('0xdfae8801') || message.includes('MaxChurnRateExceeded')) {
                message = `Stake amount too high — exceeds the maximum churn rate. The network limits how much weight can change at once (typically 20% of total weight). Try staking a smaller amount and increase it incrementally.`;
            } else if (message.includes('0x4c8eb65e') || message.includes('InvalidBLSKeyLength')) {
                message = 'Invalid BLS public key length. Expected 48 bytes. Please check the validator credentials.';
            } else if (message.includes('reverted')) {
                message = `Transaction reverted. This may be due to: churn rate exceeded (stake too high), invalid node credentials, or the node already being registered. Try a smaller stake amount.`;
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
                            ? `Minimum: ${contractSettings.minimumDelegationFeeBips} bips (${contractSettings.minimumDelegationFeeBips / 100}%). Fee charged to delegators (100 = 1%, 10000 = 100%)`
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
