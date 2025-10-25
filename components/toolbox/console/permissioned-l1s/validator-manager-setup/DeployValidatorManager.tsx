"use client";

import { useToolboxStore, useViemChainStore } from "@/components/toolbox/stores/toolboxStore";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useState, useMemo } from "react";
import { Button } from "@/components/toolbox/components/Button";
import { keccak256 } from 'viem';
import ValidatorManagerABI from "@/contracts/icm-contracts/compiled/ValidatorManager.json";
import ValidatorMessagesABI from "@/contracts/icm-contracts/compiled/ValidatorMessages.json";
import { ProgressSteps as Steps, ProgressStep as Step } from "@/components/toolbox/components/ProgressSteps";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import versions from '@/scripts/versions.json';
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { Copy, Check } from "lucide-react";

const ICM_COMMIT = versions["ava-labs/icm-contracts"];
const VALIDATOR_MANAGER_SOURCE_URL = `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/ValidatorManager.sol`;
const VALIDATOR_MESSAGES_SOURCE_URL = `https://github.com/ava-labs/icm-contracts/blob/${ICM_COMMIT}/contracts/validator-manager/ValidatorMessages.sol`;

function calculateLibraryHash(libraryPath: string) {
    const hash = keccak256(
        new TextEncoder().encode(libraryPath)
    ).slice(2);
    return hash.slice(0, 34);
}

const metadata: ConsoleToolMetadata = {
    title: "Deploy Validator Contracts",
    description: "Deploy the ValidatorMessages library and ValidatorManager contract to the EVM network",
    toolRequirements: [
        WalletRequirementsConfigKey.EVMChainBalance
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

// Simple component to show deployment status - clickable address to copy
function DeploymentStatus({ address }: { address: string }) {
    const [copied, setCopied] = useState(false);

    if (!address) {
        return <p className="text-sm text-gray-500 mt-2">Deployment Status: Not deployed</p>;
    }

    const handleCopy = async () => {
        await navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    return (
        <button
            onClick={handleCopy}
            className="mt-2 w-full p-3 rounded-lg border-2 border-green-500 dark:border-green-500 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/40 transition-colors cursor-pointer group"
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs text-green-700 dark:text-green-400 font-medium mb-1">Deployment Status</p>
                    <code className="text-sm text-green-900 dark:text-green-100 break-all">{address}</code>
                </div>
                <div className="flex-shrink-0">
                    {copied ? (
                        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                    ) : (
                        <Copy className="h-4 w-4 text-green-600 dark:text-green-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                </div>
            </div>
        </button>
    );
}

function DeployValidatorContracts({ onSuccess }: BaseConsoleToolProps) {
    const { validatorMessagesLibAddress, setValidatorMessagesLibAddress, setValidatorManagerAddress, validatorManagerAddress } = useToolboxStore();
    const { publicClient, walletEVMAddress } = useWalletStore();
    const { coreWalletClient } = useConnectedWallet();
    const [isDeployingMessages, setIsDeployingMessages] = useState(false);
    const [isDeployingManager, setIsDeployingManager] = useState(false);
    const viemChain = useViemChainStore();

    const { sendCoreWalletNotSetNotification, notify } = useConsoleNotifications();

    const getLinkedBytecode = () => {
        if (!validatorMessagesLibAddress) {
            throw new Error('ValidatorMessages library must be deployed first');
        }

        const libraryPath = `${Object.keys(ValidatorManagerABI.bytecode.linkReferences)[0]}:${Object.keys(Object.values(ValidatorManagerABI.bytecode.linkReferences)[0])[0]}`;
        const libraryHash = calculateLibraryHash(libraryPath);
        const libraryPlaceholder = `__$${libraryHash}$__`;

        const linkedBytecode = ValidatorManagerABI.bytecode.object
            .split(libraryPlaceholder)
            .join(validatorMessagesLibAddress.slice(2).padStart(40, '0'));

        if (linkedBytecode.includes("$__")) {
            throw new Error("Failed to replace library placeholder with actual address");
        }

        return linkedBytecode as `0x${string}`;
    };

    async function deployValidatorMessages() {
        setIsDeployingMessages(true);
        setValidatorMessagesLibAddress("");

        
        if (!viemChain) throw new Error("Viem chain not found");
        await coreWalletClient.addChain({ chain: viemChain });
        await coreWalletClient.switchChain({ id: viemChain.id });
        const deployPromise = coreWalletClient.deployContract({
            abi: ValidatorMessagesABI.abi as any,
            bytecode: ValidatorMessagesABI.bytecode.object as `0x${string}`,
            args: [],
            chain: viemChain,
            account: walletEVMAddress as `0x${string}`
        });

        notify({
            type: 'deploy',
            name: 'ValidatorMessages Library'
        }, deployPromise, viemChain ?? undefined);

        const hash = await deployPromise;
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (!receipt.contractAddress) {
            throw new Error('No contract address in receipt');
        }
        setValidatorMessagesLibAddress(receipt.contractAddress as string);
        setIsDeployingMessages(false);

    }

    async function deployValidatorManager() {
        setIsDeployingManager(true);
        setValidatorManagerAddress("");

        if (!viemChain) throw new Error("Viem chain not found");
        await coreWalletClient.addChain({ chain: viemChain });
        await coreWalletClient.switchChain({ id: viemChain.id });
        const deployPromise = coreWalletClient.deployContract({
            abi: ValidatorManagerABI.abi as any,
            bytecode: getLinkedBytecode(),
            args: [0],
            chain: viemChain,
            account: walletEVMAddress as `0x${string}`
        });

        notify({
            type: 'deploy',
            name: 'ValidatorManager'
        }, deployPromise, viemChain ?? undefined);

        const hash = await deployPromise;
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (!receipt.contractAddress) {
            throw new Error('No contract address in receipt');
        }
        setValidatorManagerAddress(receipt.contractAddress as string);
        setIsDeployingManager(false);
        onSuccess?.();
    }

    // Calculate current step and completed steps
    const currentStep = useMemo(() => {
        if (validatorManagerAddress) return 2; // Both done
        if (validatorMessagesLibAddress) return 2; // Step 1 done, step 2 is current
        return 1; // Starting
    }, [validatorMessagesLibAddress, validatorManagerAddress]);

    const completedSteps = useMemo(() => {
        const completed: number[] = [];
        if (validatorMessagesLibAddress) completed.push(1);
        if (validatorManagerAddress) completed.push(2);
        return completed;
    }, [validatorMessagesLibAddress, validatorManagerAddress]);

    return (
        <>
                <div className="space-y-4">
                    <Steps currentStep={currentStep} completedSteps={completedSteps}>
                        <Step stepNumber={1}>
                            <h2 className="text-lg font-semibold">Deploy Validator Messages Library</h2>
                            <p className="text-sm text-gray-500">
                                This will deploy the <code>ValidatorMessages</code> contract to the EVM network <code>{viemChain?.id}</code>. <code>ValidatorMessages</code> is a library required by the <code>ValidatorManager</code> family of contracts.
                            </p>
                            <p className="text-sm text-gray-500">
                                Library source: <a href={VALIDATOR_MESSAGES_SOURCE_URL} target="_blank" rel="noreferrer">ValidatorMessages.sol</a> @ <code>{ICM_COMMIT.slice(0, 7)}</code>
                            </p>

                            <Button
                                variant="primary"
                                onClick={deployValidatorMessages}
                                loading={isDeployingMessages}
                                disabled={isDeployingMessages}
                            >
                                Deploy Library
                            </Button>

                            <DeploymentStatus address={validatorMessagesLibAddress} />

                        </Step>

                        <Step stepNumber={2}>
                            <h2 className="text-lg font-semibold">Deploy Validator Manager Contract</h2>
                            <p className="text-sm text-gray-500">
                                This will deploy the <code>ValidatorManager</code> contract to the EVM network <code>{viemChain?.id}</code>. It is the interface for managing the validators for it's L1. The contract emits the ICM messages to change the L1s validator set on the P-Chain.
                            </p>
                            <p className="text-sm text-gray-500">
                                Contract source: <a href={VALIDATOR_MANAGER_SOURCE_URL} target="_blank" rel="noreferrer">ValidatorManager.sol</a> @ <code>{ICM_COMMIT.slice(0, 7)}</code>
                            </p>

                            <Button
                                variant="primary"
                                onClick={deployValidatorManager}
                                loading={isDeployingManager}
                                disabled={isDeployingManager || !validatorMessagesLibAddress}
                                className="mt-1"
                            >
                                Deploy Manager Contract
                            </Button>

                            <DeploymentStatus address={validatorManagerAddress} />

                        </Step>
                    </Steps>
                </div>
        </>
    );
}

export default withConsoleToolMetadata(DeployValidatorContracts, metadata);
