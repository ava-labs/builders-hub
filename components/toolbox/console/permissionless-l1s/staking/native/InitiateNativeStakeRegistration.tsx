import React, { useState, useEffect, useMemo } from 'react';
import { useViemChainStore } from '@/components/toolbox/stores/toolboxStore';
import { useWalletStore } from '@/components/toolbox/stores/walletStore';
import { useL1ListStore } from '@/components/toolbox/stores/l1ListStore';
import { Button } from '@/components/toolbox/components/Button';
import { Input } from '@/components/toolbox/components/Input';
import { ConvertToL1Validator } from '@/components/toolbox/components/ValidatorListInput';
import { validateStakePercentage } from '@/components/toolbox/coreViem/hooks/getTotalStake';
import nativeTokenStakingManagerAbi from '@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json';
import validatorManagerAbi from '@/contracts/icm-contracts/compiled/ValidatorManager.json';
import { Success } from '@/components/toolbox/components/Success';
import { parseNodeID } from '@/components/toolbox/coreViem/utils/ids';
import { fromBytes, parseEther, formatEther } from 'viem';
import { utils } from '@avalabs/avalanchejs';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { Alert } from '@/components/toolbox/components/Alert';
import { getValidationIdHex } from '@/components/toolbox/coreViem/hooks/getValidationID';

interface InitiateNativeStakeRegistrationProps {
    subnetId: string;
    validatorManagerAddress: string;
    stakingManagerAddress: string;
    validators: ConvertToL1Validator[];
    onSuccess: (data: {
        txHash: `0x${string}`;
        nodeId: string;
        validationId: string;
        weight: string;
        unsignedWarpMessage: string;
        validatorBalance: string;
        blsProofOfPossession: string;
    }) => void;
    onError: (message: string) => void;
    contractTotalWeight: bigint;
    l1WeightError: string | null;
}

const InitiateNativeStakeRegistration: React.FC<InitiateNativeStakeRegistrationProps> = ({
    subnetId,
    validatorManagerAddress,
    stakingManagerAddress,
    validators,
    onSuccess,
    onError,
    contractTotalWeight,
}) => {
    const { coreWalletClient, publicClient, walletEVMAddress, walletChainId } = useWalletStore();
    const { notify } = useConsoleNotifications();
    const viemChain = useViemChainStore();
    const l1List = useL1ListStore()((state: any) => state.l1List);

    const tokenSymbol = useMemo(() => {
        const currentL1 = l1List.find((l1: any) => l1.evmChainId === walletChainId);
        return currentL1?.coinName || 'AVAX';
    }, [l1List, walletChainId]);

    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setErrorState] = useState<string | null>(null);
    const [txSuccess, setTxSuccess] = useState<string | null>(null);

    // Staking-specific fields
    const [stakeAmount, setStakeAmount] = useState<string>('');
    const [delegationFeeBips, setDelegationFeeBips] = useState<string>('200'); // 2% default
    const [minStakeDuration, setMinStakeDuration] = useState<string>('0'); // 0 seconds default
    const [rewardRecipient, setRewardRecipient] = useState<string>('');

    // Staking manager settings
    const [stakingSettings, setStakingSettings] = useState<{
        minimumStakeAmount: bigint;
        maximumStakeAmount: bigint;
        minimumStakeDuration: bigint;
        minimumDelegationFeeBips: number;
    } | null>(null);
    const [isLoadingSettings, setIsLoadingSettings] = useState(false);

    // Fetch staking manager settings
    useEffect(() => {
        const fetchStakingSettings = async () => {
            if (!publicClient || !stakingManagerAddress) {
                setStakingSettings(null);
                return;
            }

            setIsLoadingSettings(true);
            try {
                const settings = await publicClient.readContract({
                    address: stakingManagerAddress as `0x${string}`,
                    abi: nativeTokenStakingManagerAbi.abi,
                    functionName: 'getStakingManagerSettings',
                }) as any;

                setStakingSettings({
                    minimumStakeAmount: settings.minimumStakeAmount,
                    maximumStakeAmount: settings.maximumStakeAmount,
                    minimumStakeDuration: settings.minimumStakeDuration,
                    minimumDelegationFeeBips: settings.minimumDelegationFeeBips,
                });

                // Update defaults based on fetched settings (only if current values are below minimum)

                // Set default stake amount to minimum if not set
                if (!stakeAmount) {
                    setStakeAmount(formatEther(settings.minimumStakeAmount));
                }

                const currentFeeBips = parseInt(delegationFeeBips) || 0;
                if (settings.minimumDelegationFeeBips > currentFeeBips) {
                    setDelegationFeeBips(settings.minimumDelegationFeeBips.toString());
                }

                const currentDuration = BigInt(minStakeDuration || '0');
                if (settings.minimumStakeDuration > currentDuration) {
                    setMinStakeDuration(settings.minimumStakeDuration.toString());
                }
            } catch (err) {
                console.error('Failed to fetch staking settings:', err);
                setStakingSettings(null);
            } finally {
                setIsLoadingSettings(false);
            }
        };

        fetchStakingSettings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [publicClient, stakingManagerAddress]);

    // Update reward recipient when wallet address changes
    useEffect(() => {
        if (walletEVMAddress && !rewardRecipient) {
            setRewardRecipient(walletEVMAddress);
        }
    }, [walletEVMAddress, rewardRecipient]);

    const validateInputs = (): boolean => {
        if (validators.length === 0) {
            setErrorState("Please add a validator to continue");
            return false;
        }

        // Validate stake amount
        const stakeNum = parseFloat(stakeAmount);
        if (isNaN(stakeNum) || stakeNum <= 0) {
            setErrorState("Please enter a valid stake amount");
            return false;
        }

        const stakeAmountWei = parseEther(stakeAmount);

        // Validate stake amount against staking manager settings
        if (stakingSettings) {
            if (stakeAmountWei < stakingSettings.minimumStakeAmount) {
                setErrorState(`Stake amount (${formatEther(stakeAmountWei)} ${tokenSymbol}) is below the minimum required stake (${formatEther(stakingSettings.minimumStakeAmount)} ${tokenSymbol})`);
                return false;
            }

            if (stakeAmountWei > stakingSettings.maximumStakeAmount) {
                setErrorState(`Stake amount (${formatEther(stakeAmountWei)} ${tokenSymbol}) exceeds the maximum allowed stake (${formatEther(stakingSettings.maximumStakeAmount)} ${tokenSymbol})`);
                return false;
            }
        }

        // Validate delegation fee (0-10000 basis points = 0-100%)
        const feeBips = parseInt(delegationFeeBips);
        if (isNaN(feeBips) || feeBips < 0 || feeBips > 10000) {
            setErrorState("Delegation fee must be between 0 and 10000 basis points (0-100%)");
            return false;
        }

        // Validate against minimum delegation fee from staking manager
        if (stakingSettings && feeBips < stakingSettings.minimumDelegationFeeBips) {
            setErrorState(`Delegation fee (${feeBips} bips) is below the minimum required (${stakingSettings.minimumDelegationFeeBips} bips)`);
            return false;
        }

        // Validate min stake duration
        const duration = parseInt(minStakeDuration);
        if (isNaN(duration) || duration < 0) {
            setErrorState("Minimum stake duration must be a positive number");
            return false;
        }

        // Validate against minimum stake duration from staking manager
        if (stakingSettings && BigInt(duration) < stakingSettings.minimumStakeDuration) {
            setErrorState(`Minimum stake duration (${duration}s) is below the required minimum (${stakingSettings.minimumStakeDuration.toString()}s)`);
            return false;
        }

        // Validate reward recipient address
        if (!rewardRecipient || !rewardRecipient.match(/^0x[a-fA-F0-9]{40}$/)) {
            setErrorState("Please provide a valid reward recipient address");
            return false;
        }

        return true;
    };

    const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

    const maybeResendIfAlreadyRegisteredOnEvm = async (params: {
        account: `0x${string}`;
        nodeId: string;
        stakeAmountWei: bigint;
    }) => {
        const { account, nodeId } = params;

        if (!publicClient || !coreWalletClient) return null;
        if (!validatorManagerAddress) return null;

        const nodeIdBytes = parseNodeID(nodeId);

        // If the node is already tracked in EVM state (registeredValidators / getNodeValidationID),
        // it can mean the previous initiation succeeded on EVM but the P-Chain step wasn't done.
        const validationId = await getValidationIdHex(
            publicClient,
            validatorManagerAddress as `0x${string}`,
            nodeIdBytes
        );

        if (!validationId || validationId === ZERO_BYTES32) return null;

        // Heuristic: if the validator exists but hasn't started yet, it's likely PendingAdded
        // (EVM state set, but P-Chain confirmation not completed).
        try {
            const v = await publicClient.readContract({
                address: validatorManagerAddress as `0x${string}`,
                abi: validatorManagerAbi.abi,
                functionName: "getValidator",
                args: [validationId],
            }) as any;

            const startTime = (v?.startTime ?? 0n) as bigint;
            const isPending = startTime === 0n;
            if (!isPending) return null;
        } catch {
            // If we can't read validator details, don't attempt the resend path.
            return null;
        }

        // Resend the original RegisterL1ValidatorMessage from the ValidatorManager to get a fresh warp message.
        const writePromise = coreWalletClient.writeContract({
            address: validatorManagerAddress as `0x${string}`,
            abi: validatorManagerAbi.abi,
            functionName: "resendRegisterValidatorMessage",
            args: [validationId],
            account,
            chain: viemChain
        });

        notify({
            type: 'call',
            name: 'Resend Validator Registration (Warp Message)'
        }, writePromise, viemChain ?? undefined);

        const receipt = await publicClient.waitForTransactionReceipt({ hash: await writePromise });
        if (receipt.status === 'reverted') {
            throw new Error(`Resend transaction reverted. Hash: ${receipt.transactionHash}`);
        }

        const unsignedWarpMessage = receipt.logs[0]?.data ?? "";
        return {
            txHash: receipt.transactionHash as `0x${string}`,
            validationId,
            unsignedWarpMessage,
        };
    };

    const handleInitiateStakingValidatorRegistration = async () => {
        setErrorState(null);
        setTxSuccess(null);

        if (!coreWalletClient) {
            setErrorState("Core wallet not found");
            return;
        }

        if (!stakingManagerAddress) {
            setErrorState("Staking Manager Address is required. Please select a valid L1 subnet.");
            return;
        }

        if (!validatorManagerAddress) {
            setErrorState("Validator Manager Address is required. Please select a valid L1 subnet.");
            return;
        }

        if (!validateInputs()) {
            return;
        }

        setIsProcessing(true);
        try {
            const validator = validators[0];
            const [accountRaw] = await coreWalletClient.requestAddresses();
            const account = accountRaw as `0x${string}`;

            // Process P-Chain Addresses
            const pChainRemainingBalanceOwnerAddressesHex = validator.remainingBalanceOwner.addresses.map(address => {
                const addressBytes = utils.bech32ToBytes(address);
                return fromBytes(addressBytes, "hex");
            });

            const pChainDisableOwnerAddressesHex = validator.deactivationOwner.addresses.map(address => {
                const addressBytes = utils.bech32ToBytes(address);
                return fromBytes(addressBytes, "hex");
            });

            // Build arguments for staking manager transaction
            const args = [
                parseNodeID(validator.nodeID),
                validator.nodePOP.publicKey,
                {
                    threshold: validator.remainingBalanceOwner.threshold,
                    addresses: pChainRemainingBalanceOwnerAddressesHex,
                },
                {
                    threshold: validator.deactivationOwner.threshold,
                    addresses: pChainDisableOwnerAddressesHex,
                },
                parseInt(delegationFeeBips), // delegationFeeBips
                parseInt(minStakeDuration), // minStakeDuration
                rewardRecipient as `0x${string}` // rewardRecipient
            ];

            // Calculate stake amount in wei
            const stakeAmountWei = parseEther(stakeAmount);

            let receipt;

            try {
                // If the node is already registered in EVM state but hasn't been finalized (P-Chain step),
                // resend the initiation to emit a fresh warp message instead of staking again.
                const resendResult = await maybeResendIfAlreadyRegisteredOnEvm({
                    account,
                    nodeId: validator.nodeID,
                    stakeAmountWei,
                });

                if (resendResult) {
                    setTxSuccess(`Transaction successful! Hash: ${resendResult.txHash}`);
                    onSuccess({
                        txHash: resendResult.txHash,
                        nodeId: validator.nodeID,
                        validationId: resendResult.validationId,
                        weight: '0',
                        unsignedWarpMessage: resendResult.unsignedWarpMessage,
                        validatorBalance: stakeAmount,
                        blsProofOfPossession: validator.nodePOP.proofOfPossession,
                    });
                    return;
                }

                const writePromise = coreWalletClient.writeContract({
                    address: stakingManagerAddress as `0x${string}`,
                    abi: nativeTokenStakingManagerAbi.abi,
                    functionName: "initiateValidatorRegistration",
                    args,
                    value: stakeAmountWei,
                    account,
                    chain: viemChain
                });

                notify({
                    type: 'call',
                    name: 'Initiate Staking Validator Registration'
                }, writePromise, viemChain ?? undefined);

                receipt = await publicClient.waitForTransactionReceipt({ hash: await writePromise });

                if (receipt.status === 'reverted') {
                    setErrorState(`Transaction reverted. Hash: ${receipt.transactionHash}`);
                    onError(`Transaction reverted. Hash: ${receipt.transactionHash}`);
                    return;
                }

                const unsignedWarpMessage = receipt.logs[0].data ?? "";
                const validationIdHex = receipt.logs[1].topics[1] ?? "";

                setTxSuccess(`Transaction successful! Hash: ${receipt.transactionHash}`);
                onSuccess({
                    txHash: receipt.transactionHash as `0x${string}`,
                    nodeId: validator.nodeID,
                    validationId: validationIdHex,
                    weight: '0', // Weight is calculated by staking manager, not needed here
                    unsignedWarpMessage: unsignedWarpMessage,
                    validatorBalance: stakeAmount, // Use the actual stake amount entered
                    blsProofOfPossession: validator.nodePOP.proofOfPossession,
                });

            } catch (txError: any) {
                let message = txError instanceof Error ? txError.message : String(txError);

                if (message.includes('User rejected')) {
                    message = 'Transaction was rejected by user';
                } else if (message.includes('insufficient funds')) {
                    message = 'Insufficient funds for transaction';
                } else if (message.includes('execution reverted')) {
                    message = `Transaction reverted: ${message}`;
                } else if (message.includes('nonce')) {
                    message = 'Transaction nonce error. Please try again.';
                }

                setErrorState(`Transaction failed: ${message}`);
                onError(`Transaction failed: ${message}`);
            }
        } catch (err: any) {
            let message = err instanceof Error ? err.message : String(err);

            if (message.includes('User rejected')) {
                message = 'Transaction was rejected by user';
            } else if (message.includes('insufficient funds')) {
                message = 'Insufficient funds for transaction';
            } else if (message.includes('execution reverted')) {
                message = `Transaction reverted: ${message}`;
            } else if (message.includes('nonce')) {
                message = 'Transaction nonce error. Please try again.';
            }

            setErrorState(`Transaction failed: ${message}`);
            onError(`Transaction failed: ${message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!subnetId) {
        return (
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
                Please select an L1 subnet first.
            </div>
        );
    }

    if (validators.length === 0) {
        return (
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
                Please add a validator in the previous step.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
                <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                    Staking Parameters
                </h3>

                <div className="space-y-3">
                    <Input
                        label={`Stake Amount (${tokenSymbol})`}
                        value={stakeAmount}
                        onChange={setStakeAmount}
                        placeholder={stakingSettings ? formatEther(stakingSettings.minimumStakeAmount) : "1.0"}
                        disabled={isProcessing || txSuccess !== null}
                        helperText={stakingSettings
                            ? `Amount to stake (min: ${formatEther(stakingSettings.minimumStakeAmount)} ${tokenSymbol}, max: ${formatEther(stakingSettings.maximumStakeAmount)} ${tokenSymbol})`
                            : `Amount to stake in ${tokenSymbol}`}
                        type="number"
                        step="0.01"
                    />

                    <Input
                        label="Delegation Fee (basis points)"
                        value={delegationFeeBips}
                        onChange={setDelegationFeeBips}
                        placeholder="200"
                        disabled={isProcessing || txSuccess !== null}
                        helperText={stakingSettings
                            ? `Fee charged to delegators (min: ${stakingSettings.minimumDelegationFeeBips} bips, max: 10000 bips)`
                            : "Fee charged to delegators (200 = 2%, max 10000 = 100%)"}
                        type="number"
                    />

                    <Input
                        label="Minimum Stake Duration (seconds)"
                        value={minStakeDuration}
                        onChange={setMinStakeDuration}
                        placeholder="0"
                        disabled={isProcessing || txSuccess !== null}
                        helperText={stakingSettings
                            ? `Minimum time delegators must stake (min: ${stakingSettings.minimumStakeDuration.toString()}s)`
                            : "Minimum time delegators must stake (0 = no minimum)"}
                        type="number"
                    />

                    <Input
                        label="Reward Recipient Address"
                        value={rewardRecipient}
                        onChange={setRewardRecipient}
                        placeholder="0x..."
                        disabled={isProcessing || txSuccess !== null}
                        helperText="Address that will receive staking rewards"
                    />
                </div>
            </div>

            <Button
                onClick={handleInitiateStakingValidatorRegistration}
                disabled={
                    isProcessing ||
                    validators.length === 0 ||
                    !stakingManagerAddress ||
                    !stakeAmount ||
                    txSuccess !== null ||
                    isLoadingSettings
                }
                error={
                    !stakingManagerAddress && subnetId
                        ? "Could not find Staking Manager for this L1. Make sure the Validator Manager is owned by a Staking Manager contract."
                        : undefined
                }
            >
                {txSuccess ? 'Transaction Completed' : (isProcessing ? 'Processing...' : 'Initiate Staking Validator Registration')}
            </Button>

            {error && (
                <Alert variant="error">{error}</Alert>
            )}

            {txSuccess && (
                <Success
                    label="Transaction Hash"
                    value={txSuccess.replace('Transaction successful! Hash: ', '')}
                />
            )}
        </div>
    );
};

export default InitiateNativeStakeRegistration;