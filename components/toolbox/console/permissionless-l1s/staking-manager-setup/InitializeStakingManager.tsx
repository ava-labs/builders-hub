"use client";

import { useState, useEffect } from "react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useToolboxStore, useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { Button } from "@/components/toolbox/components/Button";
import { EVMAddressInput } from "@/components/toolbox/components/EVMAddressInput";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from '../../../components/WithConsoleToolMetadata';
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { ResultField } from "@/components/toolbox/components/ResultField";
import { Step, Steps } from "fumadocs-ui/components/steps";
import SelectSubnet, { SubnetSelection } from '@/components/toolbox/components/SelectSubnet';
import { useValidatorManagerDetails } from '@/components/toolbox/hooks/useValidatorManagerDetails';
import { Callout } from "fumadocs-ui/components/callout";
import NativeTokenStakingManager from "@/contracts/icm-contracts/compiled/NativeTokenStakingManager.json";
import ERC20TokenStakingManager from "@/contracts/icm-contracts/compiled/ERC20TokenStakingManager.json";
import { parseEther } from "viem";
import versions from '@/scripts/versions.json';
import { cb58ToHex } from '@/components/toolbox/console/utilities/format-converter/FormatConverter';
import useConsoleNotifications from '@/hooks/useConsoleNotifications';
import { toast } from 'sonner';
import { useCriticalError } from "@/components/toolbox/hooks/useCriticalError";
import { StakingParametersForm } from "@/components/toolbox/components/StakingParametersForm";
import { jsonStringifyWithBigint } from "@/components/toolbox/utils/json";

const ICM_COMMIT = versions["ava-labs/icm-contracts"];

const metadata: ConsoleToolMetadata = {
    title: "Initialize Staking Manager",
    description: "Initialize a Staking Manager contract with the required configuration.",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance,
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

type TokenType = 'native' | 'erc20';

interface InitializeStakingManagerProps extends BaseConsoleToolProps {
    initialTokenType?: TokenType;
}

function InitializeStakingManager({ initialTokenType }: InitializeStakingManagerProps) {
    const { setCriticalError } = useCriticalError();
    const { coreWalletClient, publicClient, walletEVMAddress } = useWalletStore();
    const viemChain = useViemChainStore();
    const {
        nativeStakingManagerAddress,
        erc20StakingManagerAddress,
        rewardCalculatorAddress: storedRewardCalculatorAddress,
        exampleErc20Address
    } = useToolboxStore();
    const { notify } = useConsoleNotifications();

    // Auto-detect token type based on which staking manager address is stored from step 1
    // If ERC20 address is set, use ERC20. Otherwise default to native.
    const detectedTokenType: TokenType = erc20StakingManagerAddress ? 'erc20' : 'native';
    const tokenType = initialTokenType || detectedTokenType;

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
    const [stakingTokenAddress, setStakingTokenAddress] = useState<string>("");

    const isNative = tokenType === 'native';
    const contractJson = isNative ? NativeTokenStakingManager : ERC20TokenStakingManager;
    const contractName = isNative ? 'Native Token Staking Manager' : 'ERC20 Token Staking Manager';
    const sourceUrl = `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/${isNative ? 'NativeTokenStakingManager' : 'ERC20TokenStakingManager'}.sol#${isNative ? '43' : '53'}`;

    // Get validator manager details from subnet ID
    const {
        validatorManagerAddress,
        error: validatorManagerError,
        isLoading: isLoadingVMCDetails,
    } = useValidatorManagerDetails({ subnetId: subnetSelection.subnetId });

    // Extract blockchain ID from subnet data
    const blockchainId = subnetSelection.subnet?.blockchains?.[0]?.blockchainId || null;

    // Auto-fill addresses from store if available
    useEffect(() => {
        const storedAddress = isNative ? nativeStakingManagerAddress : erc20StakingManagerAddress;
        if (storedAddress && !stakingManagerAddressInput) {
            setStakingManagerAddressInput(storedAddress);
        }
    }, [nativeStakingManagerAddress, erc20StakingManagerAddress, stakingManagerAddressInput, isNative]);

    useEffect(() => {
        if (storedRewardCalculatorAddress && !rewardCalculatorAddress) {
            setRewardCalculatorAddress(storedRewardCalculatorAddress);
        }
    }, [storedRewardCalculatorAddress, rewardCalculatorAddress]);

    useEffect(() => {
        if (exampleErc20Address && !stakingTokenAddress && !isNative) {
            setStakingTokenAddress(exampleErc20Address);
        }
    }, [exampleErc20Address, stakingTokenAddress, isNative]);

    // Reset token address when switching to native
    useEffect(() => {
        if (isNative) {
            setStakingTokenAddress("");
        }
    }, [isNative]);

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
            if (isNative) {
                // Native token staking manager
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
            } else {
                // ERC20 token staking manager - use getStakingManagerSettings
                const settings = await publicClient.readContract({
                    address: stakingManagerAddressInput as `0x${string}`,
                    abi: ERC20TokenStakingManager.abi,
                    functionName: 'getStakingManagerSettings',
                }) as any;

                const initialized = BigInt(settings.minimumStakeAmount) > 0n;
                setIsInitialized(initialized);

                if (initialized) {
                    // Also get the ERC20 token address
                    const token = await publicClient.readContract({
                        address: stakingManagerAddressInput as `0x${string}`,
                        abi: ERC20TokenStakingManager.abi,
                        functionName: 'erc20',
                    });
                    setInitEvent({ settings, stakingToken: token });
                    toast.success('Contract is already initialized');
                } else {
                    toast.info('Contract is not initialized yet');
                }
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
            if (!isNative && !stakingTokenAddress) throw new Error("Staking Token address required");
            if (!blockchainId) throw new Error("Blockchain ID not found. Please select a valid subnet.");

            // Convert blockchain ID from CB58 to hex and pad to 32 bytes (64 hex chars)
            let hexBlockchainId = cb58ToHex(blockchainId);
            if (hexBlockchainId.length < 64) {
                hexBlockchainId = hexBlockchainId.padStart(64, '0');
            }
            hexBlockchainId = `0x${hexBlockchainId}` as `0x${string}`;

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

            // Build args based on token type
            const args = isNative ? [settings] : [settings, stakingTokenAddress as `0x${string}`];

            // Estimate gas for initialization
            const gasEstimate = await publicClient.estimateContractGas({
                address: stakingManagerAddressInput as `0x${string}`,
                abi: contractJson.abi,
                functionName: 'initialize',
                args,
                account: walletEVMAddress as `0x${string}`,
            });

            // Add 20% buffer to gas estimate for safety
            const gasWithBuffer = gasEstimate + (gasEstimate * 20n / 100n);

            const writePromise = coreWalletClient.writeContract({
                address: stakingManagerAddressInput as `0x${string}`,
                abi: contractJson.abi,
                functionName: 'initialize',
                args,
                chain: viemChain,
                gas: gasWithBuffer,
                account: walletEVMAddress as `0x${string}`,
            });

            notify({
                type: 'call',
                name: `Initialize ${contractName}`
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
                        Choose the L1 subnet where the {contractName} will be initialized. The Validator Manager address and blockchain ID will be automatically derived from your selection.
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
                                <strong>Note:</strong> This subnet has not been converted to an L1 yet. Staking Manager can only be initialized for L1s.
                            </p>
                        </div>
                    )}

                    {validatorManagerAddress && (
                        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
                            <p className="text-sm">
                                <strong>Validator Manager Address:</strong> <code>{validatorManagerAddress}</code>
                            </p>
                        </div>
                    )}
                </Step>

                <Step>
                    <h2 className="text-lg font-semibold">Select {contractName}</h2>
                    <p className="text-sm text-gray-500">
                        Select the {contractName} contract you want to initialize.
                    </p>
                    <p className="text-sm text-gray-500">
                        Initialize function source: <a href={sourceUrl} target="_blank" rel="noreferrer">initialize()</a> @ <code>{ICM_COMMIT.slice(0, 7)}</code>
                    </p>

                    <EVMAddressInput
                        label={`${contractName} Address`}
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
                    <h2 className="text-lg font-semibold">
                        Configure {isNative ? 'Reward Calculator' : 'Staking Token & Rewards'}
                    </h2>
                    <p className="text-sm text-gray-500">
                        {isNative
                            ? 'Set the Reward Calculator contract address that determines how rewards are distributed to validators. The Validator Manager address and Uptime Blockchain ID are automatically derived from your subnet selection.'
                            : 'Set the ERC20 token that will be used for staking and the Reward Calculator contract address. The Validator Manager address and Uptime Blockchain ID are automatically derived from your subnet selection.'}
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
                                            {blockchainId ? `0x${cb58ToHex(blockchainId).padStart(64, '0')}` : 'N/A'}
                                        </code>
                                    </p>
                                )}
                            </div>
                        )}

                        {!isNative && (
                            <>
                                <EVMAddressInput
                                    label="Staking Token Address (ERC20)"
                                    value={stakingTokenAddress}
                                    onChange={setStakingTokenAddress}
                                    disabled={isInitializing}
                                    helperText="The ERC20 token that validators and delegators will stake"
                                />

                                <Callout type="warn">
                                    <p className="font-semibold mb-1">Important: Token Requirements</p>
                                    <p>The ERC20 token must implement the <code>IERC20Mintable</code> interface.
                                        This allows the staking manager to mint rewards. Care should be taken to enforce that only
                                        authorized users (i.e., the staking manager contract) are able to mint the ERC20 staking token.</p>
                                </Callout>
                            </>
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

                    <StakingParametersForm
                        minimumStakeAmount={minimumStakeAmount}
                        setMinimumStakeAmount={setMinimumStakeAmount}
                        maximumStakeAmount={maximumStakeAmount}
                        setMaximumStakeAmount={setMaximumStakeAmount}
                        minimumStakeDuration={minimumStakeDuration}
                        setMinimumStakeDuration={setMinimumStakeDuration}
                        minimumDelegationFeeBips={minimumDelegationFeeBips}
                        setMinimumDelegationFeeBips={setMinimumDelegationFeeBips}
                        maximumStakeMultiplier={maximumStakeMultiplier}
                        setMaximumStakeMultiplier={setMaximumStakeMultiplier}
                        weightToValueFactor={weightToValueFactor}
                        setWeightToValueFactor={setWeightToValueFactor}
                        disabled={isInitializing}
                        tokenLabel={isNative ? 'native tokens' : 'tokens'}
                    />

                    <Button
                        variant="primary"
                        onClick={handleInitialize}
                        loading={isInitializing}
                        disabled={
                            isInitializing ||
                            !subnetSelection.subnetId ||
                            !subnetSelection.subnet?.isL1 ||
                            !validatorManagerAddress ||
                            !rewardCalculatorAddress ||
                            (!isNative && !stakingTokenAddress) ||
                            !blockchainId
                        }
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

export default withConsoleToolMetadata(InitializeStakingManager, metadata);
