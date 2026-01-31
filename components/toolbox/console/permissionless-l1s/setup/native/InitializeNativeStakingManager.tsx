"use client";

import { useState, useEffect } from "react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useToolboxStore, useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { Button } from "@/components/toolbox/components/Button";
import { EVMAddressInput } from "@/components/toolbox/components/EVMAddressInput";
import { ConsoleToolMetadata, withConsoleToolMetadata, BaseConsoleToolProps } from '../../../../components/WithConsoleToolMetadata';
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
import { useCriticalError } from "@/components/toolbox/hooks/useCriticalError";
import { StakingParametersForm } from "@/components/toolbox/components/StakingParametersForm";
import { jsonStringifyWithBigint } from "@/components/toolbox/utils/json";
import { StepCodeViewer, type StepConfig } from "@/components/console/step-code-viewer";

const ICM_COMMIT = versions["ava-labs/icm-contracts"];

const metadata: ConsoleToolMetadata = {
    title: "Initialize Native Token Staking Manager",
    description: "Initialize the Native Token Staking Manager contract with the required configuration.",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance,
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

// SDK code examples for each step
const getCodeSteps = (params: {
    stakingManagerAddress: string;
    validatorManagerAddress: string;
    rewardCalculatorAddress: string;
    blockchainId: string;
    minimumStakeAmount: string;
    maximumStakeAmount: string;
    minimumStakeDuration: string;
    minimumDelegationFeeBips: string;
    maximumStakeMultiplier: string;
    weightToValueFactor: string;
}): StepConfig[] => [
    {
        id: "select-subnet",
        title: "Select L1 Subnet",
        description: "Retrieve subnet and blockchain IDs",
        codeType: "typescript",
        filename: "get-subnet-info.ts",
        code: `import { AvaCloudSDK } from "@avalabs/avacloud-sdk";

// Initialize AvaCloud SDK
const sdk = new AvaCloudSDK();

// Get subnet information
const subnetInfo = await sdk.data.primaryNetwork.getSubnetById({
  subnetId: "${params.blockchainId || "YOUR_SUBNET_ID"}",
  network: "fuji" // or "mainnet"
});

console.log("Blockchain ID:", subnetInfo.blockchains[0].blockchainId);
console.log("Validator Manager:", subnetInfo.l1ValidatorManagerDetails?.contractAddress);`,
    },
    {
        id: "select-staking-manager",
        title: "Select Staking Manager",
        description: "Verify staking manager deployment",
        codeType: "typescript",
        filename: "verify-deployment.ts",
        code: `import { createPublicClient, http } from "viem";
import { avalancheFuji } from "viem/chains";

const publicClient = createPublicClient({
  chain: avalancheFuji,
  transport: http()
});

// Check if contract exists at address
const bytecode = await publicClient.getBytecode({
  address: "${params.stakingManagerAddress || "0x..."}" as \`0x\${string}\`
});

if (!bytecode) {
  throw new Error("No contract found at address");
}

console.log("Contract verified:", bytecode.slice(0, 20) + "...");`,
    },
    {
        id: "configure-rewards",
        title: "Configure Reward Calculator",
        description: "Set reward calculator address",
        codeType: "solidity",
        filename: "NativeTokenStakingManager.sol",
        sourceUrl: `https://raw.githubusercontent.com/ava-labs/icm-contracts/${ICM_COMMIT}/contracts/validator-manager/NativeTokenStakingManager.sol`,
        highlightFunction: "initialize",
        githubUrl: `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/NativeTokenStakingManager.sol#L43`,
    },
    {
        id: "set-parameters",
        title: "Set Staking Parameters",
        description: "Initialize with configuration",
        codeType: "typescript",
        filename: "initialize-staking-manager.ts",
        code: `import { createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";

// NativeTokenStakingManager ABI (initialize function)
const abi = [{
  name: "initialize",
  type: "function",
  inputs: [{
    name: "settings",
    type: "tuple",
    components: [
      { name: "manager", type: "address" },
      { name: "minimumStakeAmount", type: "uint256" },
      { name: "maximumStakeAmount", type: "uint256" },
      { name: "minimumStakeDuration", type: "uint64" },
      { name: "minimumDelegationFeeBips", type: "uint16" },
      { name: "maximumStakeMultiplier", type: "uint8" },
      { name: "weightToValueFactor", type: "uint256" },
      { name: "rewardCalculator", type: "address" },
      { name: "uptimeBlockchainID", type: "bytes32" }
    ]
  }]
}] as const;

const walletClient = createWalletClient({
  chain: avalancheFuji,
  transport: http(),
  account: privateKeyToAccount("0x...")
});

// Prepare initialization settings
const settings = {
  manager: "${params.validatorManagerAddress || "0x..."}" as \`0x\${string}\`,
  minimumStakeAmount: parseEther("${params.minimumStakeAmount || "1"}"),
  maximumStakeAmount: parseEther("${params.maximumStakeAmount || "1000000"}"),
  minimumStakeDuration: BigInt(${params.minimumStakeDuration || "86400"}),
  minimumDelegationFeeBips: ${params.minimumDelegationFeeBips || "100"},
  maximumStakeMultiplier: ${params.maximumStakeMultiplier || "10"},
  weightToValueFactor: parseEther("${params.weightToValueFactor || "1"}"),
  rewardCalculator: "${params.rewardCalculatorAddress || "0x..."}" as \`0x\${string}\`,
  uptimeBlockchainID: "0x${params.blockchainId ? cb58ToHex(params.blockchainId).padStart(64, '0') : '0'.repeat(64)}" as \`0x\${string}\`
};

// Call initialize
const hash = await walletClient.writeContract({
  address: "${params.stakingManagerAddress || "0x..."}" as \`0x\${string}\`,
  abi,
  functionName: "initialize",
  args: [settings]
});

console.log("Transaction hash:", hash);`,
    },
];

function InitializeNativeStakingManager({ onSuccess }: BaseConsoleToolProps) {
    const { setCriticalError } = useCriticalError();
    const [stakingManagerAddressInput, setStakingManagerAddressInput] = useState<string>("");
    const [isChecking, setIsChecking] = useState(false);
    const [isInitializing, setIsInitializing] = useState(false);
    const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
    const [initEvent, setInitEvent] = useState<unknown>(null);
    const [subnetSelection, setSubnetSelection] = useState<SubnetSelection>({
        subnetId: "",
        subnet: null
    });
    const [activeStep, setActiveStep] = useState(0);

    // Initialization parameters
    const [minimumStakeAmount, setMinimumStakeAmount] = useState<string>("1");
    const [maximumStakeAmount, setMaximumStakeAmount] = useState<string>("1000000");
    const [minimumStakeDuration, setMinimumStakeDuration] = useState<string>("86400");
    const [minimumDelegationFeeBips, setMinimumDelegationFeeBips] = useState<string>("100");
    const [maximumStakeMultiplier, setMaximumStakeMultiplier] = useState<string>("10");
    const [weightToValueFactor, setWeightToValueFactor] = useState<string>("1");
    const [rewardCalculatorAddress, setRewardCalculatorAddress] = useState<string>("");

    const { coreWalletClient, publicClient, walletEVMAddress } = useWalletStore();
    const viemChain = useViemChainStore();
    const { nativeStakingManagerAddress: storedStakingManagerAddress, rewardCalculatorAddress: storedRewardCalculatorAddress } = useToolboxStore();
    const { notify } = useConsoleNotifications();

    const {
        validatorManagerAddress,
        error: validatorManagerError,
    } = useValidatorManagerDetails({ subnetId: subnetSelection.subnetId });

    const blockchainId = subnetSelection.subnet?.blockchains?.[0]?.blockchainId || null;

    // Auto-fill addresses from store
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

    // Generate dynamic code steps based on current form values
    const codeSteps = getCodeSteps({
        stakingManagerAddress: stakingManagerAddressInput,
        validatorManagerAddress: validatorManagerAddress || "",
        rewardCalculatorAddress,
        blockchainId: blockchainId || "",
        minimumStakeAmount,
        maximumStakeAmount,
        minimumStakeDuration,
        minimumDelegationFeeBips,
        maximumStakeMultiplier,
        weightToValueFactor,
    });

    async function checkIfInitialized() {
        if (!stakingManagerAddressInput) {
            toast.error('Please enter a staking manager address');
            return;
        }

        setIsChecking(true);
        try {
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
            if (!blockchainId) throw new Error("Blockchain ID not found");

            let hexBlockchainId = cb58ToHex(blockchainId);
            if (hexBlockchainId.length < 64) {
                hexBlockchainId = hexBlockchainId.padStart(64, '0');
            }
            hexBlockchainId = `0x${hexBlockchainId}` as `0x${string}`;

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

            const gasEstimate = await publicClient.estimateContractGas({
                address: stakingManagerAddressInput as `0x${string}`,
                abi: NativeTokenStakingManager.abi,
                functionName: 'initialize',
                args: [settings],
                account: walletEVMAddress as `0x${string}`,
            });

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
            onSuccess?.();
        } catch (error) {
            setCriticalError(error instanceof Error ? error : new Error(String(error)));
        } finally {
            setIsInitializing(false);
        }
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Left: Configuration Form */}
            <div className="flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
                <div className="flex-1 overflow-auto p-5">
                    <Steps>
                        <Step>
                            <div onFocus={() => setActiveStep(0)}>
                                <h2 className="text-lg font-semibold">Select L1 Subnet</h2>
                                <p className="text-sm text-gray-500 mb-4">
                                    Choose the L1 subnet where the staking manager will be initialized.
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
                                            <strong>Note:</strong> This subnet has not been converted to an L1 yet.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </Step>

                        <Step>
                            <div onFocus={() => setActiveStep(1)}>
                                <h2 className="text-lg font-semibold">Select Staking Manager</h2>
                                <p className="text-sm text-gray-500 mb-4">
                                    Enter the deployed staking manager contract address.
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
                                    className="mt-2"
                                >
                                    Check Status
                                </Button>
                            </div>
                        </Step>

                        <Step>
                            <div onFocus={() => setActiveStep(2)}>
                                <h2 className="text-lg font-semibold">Configure Reward Calculator</h2>
                                <p className="text-sm text-gray-500 mb-4">
                                    Set the reward calculator contract address.
                                </p>

                                {validatorManagerAddress && (
                                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md mb-4">
                                        <p className="text-sm">
                                            <strong>Validator Manager:</strong>{" "}
                                            <code className="text-xs">{validatorManagerAddress.slice(0, 10)}...{validatorManagerAddress.slice(-6)}</code>
                                        </p>
                                        {blockchainId && (
                                            <p className="text-sm mt-1">
                                                <strong>Blockchain ID:</strong>{" "}
                                                <code className="text-xs">{blockchainId.slice(0, 12)}...</code>
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
                            <div onFocus={() => setActiveStep(3)}>
                                <h2 className="text-lg font-semibold">Set Staking Parameters</h2>
                                <p className="text-sm text-gray-500 mb-4">
                                    Configure the staking parameters for validators and delegators.
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
                                    tokenLabel="native tokens"
                                />

                                <Button
                                    variant="primary"
                                    onClick={handleInitialize}
                                    loading={isInitializing}
                                    disabled={isInitializing || !subnetSelection.subnetId || !subnetSelection.subnet?.isL1 || !validatorManagerAddress || !rewardCalculatorAddress || !blockchainId}
                                    className="mt-4"
                                >
                                    Initialize Contract
                                </Button>
                            </div>
                        </Step>
                    </Steps>

                    {isInitialized === true && (
                        <ResultField
                            label="Initialization Status"
                            value={jsonStringifyWithBigint(initEvent)}
                            showCheck={isInitialized}
                        />
                    )}
                </div>
            </div>

            {/* Right: Code Viewer */}
            <StepCodeViewer
                activeStep={activeStep}
                steps={codeSteps}
                className="h-[600px]"
            />
        </div>
    );
}

export default withConsoleToolMetadata(InitializeNativeStakingManager, metadata);
