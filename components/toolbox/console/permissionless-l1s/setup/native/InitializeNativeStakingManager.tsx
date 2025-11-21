"use client";

import { useState, useEffect } from "react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useToolboxStore, useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { Button } from "@/components/toolbox/components/Button";
import { Input } from "@/components/toolbox/components/Input";
import { EVMAddressInput } from "@/components/toolbox/components/EVMAddressInput";
import { ConsoleToolMetadata, withConsoleToolMetadata } from '../../../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { ResultField } from "@/components/toolbox/components/ResultField";
import { Step, Steps } from "fumadocs-ui/components/steps";
import SelectSubnet, { SubnetSelection } from '@/components/toolbox/components/SelectSubnet';
import { useValidatorManagerDetails } from '@/components/toolbox/hooks/useValidatorManagerDetails';
import NativeTokenStakingManager from "@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json";
import { parseEther } from "viem";
import versions from '@/scripts/versions.json';
import { cb58ToHex } from '@/components/toolbox/console/utilities/format-converter/FormatConverter';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { toast } from 'sonner';

const ICM_COMMIT = versions["ava-labs/icm-contracts"];
const INITIALIZE_FUNCTION_SOURCE_URL = `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/NativeTokenStakingManager.sol#L43`;

const metadata: ConsoleToolMetadata = {
    title: "Initialize Native Token Staking Manager",
    description: "Initialize the Native Token Staking Manager contract with the required configuration.",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance,
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function InitializeNativeStakingManager() {
    const [criticalError, setCriticalError] = useState<Error | null>(null);
    const [stakingManagerAddressInput, setStakingManagerAddressInput] = useState<string>("");
    const [isChecking, setIsChecking] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
    const [initEvent, setInitEvent] = useState<unknown>(null);
    const [subnetSelection, setSubnetSelection] = useState<SubnetSelection>({
        subnetId: "",
        subnet: null
    });

    // Initialization parameters
    const [minimumStakeAmount, setMinimumStakeAmount] = useState<string>("1");
    const [maximumStakeAmount, setMaximumStakeAmount] = useState<string>("1000000");
    const [minimumStakeDuration, setMinimumStakeDuration] = useState<string>("86400"); // 1 day default
    const [minimumDelegationFeeBips, setMinimumDelegationFeeBips] = useState<string>("100"); // 1% default
    const [maximumStakeMultiplier, setMaximumStakeMultiplier] = useState<string>("10");
    const [weightToValueFactor, setWeightToValueFactor] = useState<string>("1");
    const [rewardCalculatorAddress, setRewardCalculatorAddress] = useState<string>("");

    const { coreWalletClient, publicClient, walletEVMAddress } = useWalletStore();
    const viemChain = useViemChainStore();
    const { nativeStakingManagerAddress: storedStakingManagerAddress, rewardCalculatorAddress: storedRewardCalculatorAddress } = useToolboxStore();
    const { notify } = useConsoleNotifications();

    // Get validator manager details from subnet ID
    const {
        validatorManagerAddress,
        error: validatorManagerError,
        isLoading: isLoadingVMCDetails,
    } = useValidatorManagerDetails({ subnetId: subnetSelection.subnetId });

    // Extract blockchain ID from subnet data
    const blockchainId = subnetSelection.subnet?.blockchains?.[0]?.blockchainId || null;

    // Throw critical errors during render
    if (criticalError) {
        throw criticalError;
    }

    // Auto-fill addresses from store if available
    useEffect(() => {
        if (storedStakingManagerAddress && !stakingManagerAddressInput) {
            setStakingManagerAddressInput(storedStakingManagerAddress);
        }
    }, [storedStakingManagerAddress, stakingManagerAddressInput]);

    useEffect(() => {
        if (storedRewardCalculatorAddress && !rewardCalculatorAddress) {
            setRewardCalculatorAddress(storedRewardCalculatorAddress);
        }
    }, [storedRewardCalculatorAddress, rewardCalculatorAddress]);

    async function checkIfInitialized() {
        if (!stakingManagerAddressInput) {
            toast.error('Please enter a staking manager address');
            return;
        }

        if (!publicClient) {
            toast.error('Wallet not connected or public client not available');
            return;
        }

        setIsChecking(true);
        try {
            // Try to check initialization by reading the settings
            const settings = await publicClient.readContract({
                address: stakingManagerAddressInput as `0x${string}`,
                abi: NativeTokenStakingManager.abi,
                functionName: 'getStakingManagerSettings',
            }) as any;

            const initialized = BigInt(settings.minimumStakeAmount) > 0n;
            setIsInitialized(initialized);

            if (initialized) {
                setInitEvent({ settings });
                toast.success('Contract is already initialized');
            } else {
                toast.info('Contract is not initialized yet');
            }
        } catch (error) {
            console.error('Error checking initialization status:', error);
            setIsInitialized(false);
            toast.error(error instanceof Error ? error.message : 'Failed to check initialization status');
        } finally {
            setIsChecking(false);
        }
    }

    async function handleInitialize() {
        if (!stakingManagerAddressInput) return;

        setIsInitializing(true);
        try {
            if (!coreWalletClient) throw new Error("Wallet not connected");
            if (!validatorManagerAddress) throw new Error("Validator Manager address required");
            if (!rewardCalculatorAddress) throw new Error("Reward Calculator address required");
            if (!blockchainId) throw new Error("Blockchain ID not found. Please select a valid subnet.");

            // Convert blockchain ID from CB58 to hex
            let hexBlockchainId: string;
            try {
                hexBlockchainId = cb58ToHex(blockchainId);
                // Ensure it's 32 bytes (64 hex chars)
                if (hexBlockchainId.length < 64) {
                    // Pad with zeros on the left to make it 32 bytes
                    hexBlockchainId = hexBlockchainId.padStart(64, '0');
                }
                hexBlockchainId = `0x${hexBlockchainId}` as `0x${string}`;
            } catch (error) {
                throw new Error(`Failed to convert blockchain ID to hex: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }

            // Create settings object
            const settings = {
                manager: validatorManagerAddress as `0x${string}`,
                minimumStakeAmount: parseEther(minimumStakeAmount),
                maximumStakeAmount: parseEther(maximumStakeAmount),
                minimumStakeDuration: BigInt(minimumStakeDuration),
                minimumDelegationFeeBips: parseInt(minimumDelegationFeeBips),
                maximumStakeMultiplier: parseInt(maximumStakeMultiplier),
                weightToValueFactor: parseEther(weightToValueFactor),
                rewardCalculator: rewardCalculatorAddress as `0x${string}`,
                uptimeBlockchainID: hexBlockchainId as `0x${string}`
            };

            // Estimate gas for initialization
            const gasEstimate = await publicClient.estimateContractGas({
                address: stakingManagerAddressInput as `0x${string}`,
                abi: NativeTokenStakingManager.abi,
                functionName: 'initialize',
                args: [settings],
                account: walletEVMAddress as `0x${string}`,
            });

            // Add 20% buffer to gas estimate for safety
            const gasWithBuffer = gasEstimate + (gasEstimate * 20n / 100n);

            const writePromise = coreWalletClient.writeContract({
                address: stakingManagerAddressInput as `0x${string}`,
                abi: NativeTokenStakingManager.abi,
                functionName: 'initialize',
                args: [settings],
                chain: viemChain,
                gas: gasWithBuffer,
                account: walletEVMAddress as `0x${string}`,
            });

            notify({
                type: 'call',
                name: 'Initialize Native Token Staking Manager'
            }, writePromise, viemChain ?? undefined);

            const hash = await writePromise;
            await publicClient.waitForTransactionReceipt({ hash });
            await checkIfInitialized();
        } catch (error) {
            setCriticalError(error instanceof Error ? error : new Error(String(error)));
        } finally {
            setIsInitializing(false);
        }
    }

    return (
        <>
            <Steps>
                <Step>
                    <h2 className="text-lg font-semibold">Select L1 Subnet</h2>
                    <p className="text-sm text-gray-500">
                        Choose the L1 subnet where the Native Token Staking Manager will be initialized. The Validator Manager address and blockchain ID will be automatically derived from your selection.
                    </p>
                    <SelectSubnet
                        value={subnetSelection.subnetId}
                        onChange={setSubnetSelection}
                        error={validatorManagerError}
                        hidePrimaryNetwork={true}
                    />

                    {subnetSelection.subnet && !subnetSelection.subnet.isL1 && (
                        <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                <strong>Note:</strong> This subnet has not been converted to an L1 yet. Native Token Staking Manager can only be initialized for L1s.
                            </p>
                        </div>
                    )}
                </Step>

                <Step>
                    <h2 className="text-lg font-semibold">Select Native Token Staking Manager</h2>
                    <p className="text-sm text-gray-500">
                        Select the Native Token Staking Manager contract you want to initialize.
                    </p>
                    <p className="text-sm text-gray-500">
                        Initialize function source: <a href={INITIALIZE_FUNCTION_SOURCE_URL} target="_blank" rel="noreferrer">initialize()</a> @ <code>{ICM_COMMIT.slice(0, 7)}</code>
                    </p>

                    <EVMAddressInput
                        label="Native Token Staking Manager Address"
                        value={stakingManagerAddressInput}
                        onChange={setStakingManagerAddressInput}
                        disabled={isInitializing}
                    />

                    <Button
                        onClick={checkIfInitialized}
                        loading={isChecking}
                        disabled={!stakingManagerAddressInput}
                        size="sm"
                    >
                        Check Status
                    </Button>
                </Step>

                <Step>
                    <h2 className="text-lg font-semibold">Configure Reward Calculator</h2>
                    <p className="text-sm text-gray-500">
                        Set the Reward Calculator contract address that determines how rewards are distributed to validators. The Validator Manager address and Uptime Blockchain ID are automatically derived from your subnet selection.
                    </p>

                    <div className="space-y-4">
                        {validatorManagerAddress && (
                            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                                <p className="text-sm">
                                    <strong>Validator Manager Address:</strong> <code>{validatorManagerAddress}</code>
                                </p>
                                <p className="text-sm mt-1">
                                    <strong>Uptime Blockchain ID (CB58):</strong> <code>{blockchainId || 'Loading...'}</code>
                                </p>
                                {blockchainId && (
                                    <p className="text-sm mt-1">
                                        <strong>Uptime Blockchain ID (Hex):</strong> <code>
                                            {(() => {
                                                try {
                                                    const hex = cb58ToHex(blockchainId);
                                                    return `0x${hex.padStart(64, '0')}`;
                                                } catch {
                                                    return 'Invalid CB58';
                                                }
                                            })()}
                                        </code>
                                    </p>
                                )}
                            </div>
                        )}

                        <EVMAddressInput
                            label="Reward Calculator Address"
                            value={rewardCalculatorAddress}
                            onChange={setRewardCalculatorAddress}
                            disabled={isInitializing}
                        />
                    </div>
                </Step>

                <Step>
                    <h2 className="text-lg font-semibold">Set Staking Parameters</h2>
                    <p className="text-sm text-gray-500">
                        Configure the staking parameters that define how validators and delegators can participate in securing the network.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Minimum Stake Amount (in native tokens)"
                            value={minimumStakeAmount}
                            onChange={setMinimumStakeAmount}
                            type="number"
                            step="0.000000000000000001"
                            min="0"
                            disabled={isInitializing}
                        />

                        <Input
                            label="Maximum Stake Amount (in native tokens)"
                            value={maximumStakeAmount}
                            onChange={setMaximumStakeAmount}
                            type="number"
                            step="0.000000000000000001"
                            min="0"
                            disabled={isInitializing}
                        />

                        <Input
                            label="Minimum Stake Duration (seconds)"
                            value={minimumStakeDuration}
                            onChange={setMinimumStakeDuration}
                            type="number"
                            min="0"
                            disabled={isInitializing}
                            placeholder="86400 (1 day)"
                        />

                        <Input
                            label="Minimum Delegation Fee (bips, 100 = 1%)"
                            value={minimumDelegationFeeBips}
                            onChange={setMinimumDelegationFeeBips}
                            type="number"
                            min="0"
                            max="10000"
                            disabled={isInitializing}
                        />

                        <Input
                            label="Maximum Stake Multiplier"
                            value={maximumStakeMultiplier}
                            onChange={setMaximumStakeMultiplier}
                            type="number"
                            min="1"
                            max="255"
                            disabled={isInitializing}
                        />

                        <Input
                            label="Weight to Value Factor"
                            value={weightToValueFactor}
                            onChange={setWeightToValueFactor}
                            type="number"
                            step="0.000000000000000001"
                            min="0"
                            disabled={isInitializing}
                        />
                    </div>

                    <Button
                        variant="primary"
                        onClick={handleInitialize}
                        loading={isInitializing}
                        disabled={isInitializing || !subnetSelection.subnetId || !subnetSelection.subnet?.isL1 || !validatorManagerAddress || !rewardCalculatorAddress || !blockchainId}
                    >
                        Initialize Contract
                    </Button>
                </Step>
            </Steps>

            {isInitialized === true && (
                <ResultField
                    label="Initialization Status"
                    value={jsonStringifyWithBigint(initEvent)}
                    showCheck={isInitialized}
                />
            )}
        </>
    );
}

export default withConsoleToolMetadata(InitializeNativeStakingManager, metadata);

function jsonStringifyWithBigint(value: unknown) {
    return JSON.stringify(value, (_, v) =>
        typeof v === 'bigint' ? v.toString() : v
        , 2);
}