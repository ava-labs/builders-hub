"use client";

import { useCreateChainStore } from "@/components/toolbox/stores/createChainStore";
import { useState, useRef } from "react";
import { GenesisBuilderInner } from '@/components/toolbox/console/layer-1/create/GenesisBuilder';
import { Step, Steps } from "fumadocs-ui/components/steps";
import { SUBNET_EVM_VM_ID } from "@/constants/console";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { CoreWalletTransactionButton } from "@/components/toolbox/components/CoreWalletTransactionButton";
import { ensureCoreNetworkMode, restoreCoreChain } from "@/components/toolbox/coreViem";

// Import Genesis Wizard components
import { GenesisWizard } from "@/components/toolbox/components/genesis/GenesisWizard";
import { ChainConfigStep, generateRandomChainName } from "@/components/toolbox/components/genesis/ChainConfigStep";

const metadata: ConsoleToolMetadata = {
    title: "Create Chain",
    description: <>A <Link href="/docs/avalanche-l1s/building-your-first-avalanche-l1" className="text-primary hover:underline">chain</Link> is your L1 configuration running on a <Link href="/docs/avalanche-l1s" className="text-primary hover:underline">Subnet</Link>. A Subnet can have one or more chains, each with its own name, <Link href="/docs/avalanche-l1s/evm-customization/customize-your-l1-evm" className="text-primary hover:underline">virtual machine</Link>, and <Link href="/academy/avalanche-l1/avalanche-fundamentals" className="text-primary hover:underline">genesis parameters</Link>.</>,
    toolRequirements: [
        WalletRequirementsConfigKey.WalletConnected
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

interface CreateChainProps extends BaseConsoleToolProps {
    embedded?: boolean;
}

function CreateChain({ onSuccess, embedded = false }: CreateChainProps) {
    const store = useCreateChainStore();
    const subnetId = store(state => state.subnetId);
    const setChainID = store(state => state.setChainID);
    const genesisData = store(state => state.genesisData);
    const setGenesisData = store(state => state.setGenesisData);
    const setChainName = store(state => state.setChainName);

    const coreWalletClient = useWalletStore((s) => s.coreWalletClient);
    const { isTestnet } = useWalletStore();
    const { notify } = useConsoleNotifications();

    const [isCreatingChain, setIsCreatingChain] = useState(false);
    const [localChainName, setLocalChainName] = useState<string>(generateRandomChainName());
    const [vmId, setVmId] = useState<string>(SUBNET_EVM_VM_ID);
    const prevVmIdRef = useRef(vmId);

    // Clear genesis data when switching FROM Subnet-EVM TO custom VM
    const handleVmIdChange = (newVmId: string) => {
        if (prevVmIdRef.current === SUBNET_EVM_VM_ID && newVmId !== SUBNET_EVM_VM_ID) {
            setGenesisData("");
        }
        prevVmIdRef.current = newVmId;
        setVmId(newVmId);
    };

    async function handleCreateChain() {
        if (!coreWalletClient) return;

        setIsCreatingChain(true);

        try {
            // Ensure Core Wallet is in the correct network mode for P-Chain ops
            const previousChainId = await ensureCoreNetworkMode(isTestnet);

            const createChainTx = coreWalletClient.createChain({
                chainName: localChainName,
                subnetId: subnetId,
                vmId,
                fxIds: [],
                genesisData: genesisData,
                subnetAuth: [0],
            })

            notify('createChain', createChainTx);

            const txID = await createChainTx;

            if (previousChainId) await restoreCoreChain(previousChainId);

            setChainID(txID);
            setChainName(localChainName);
            setLocalChainName(generateRandomChainName());
        } finally {
            setIsCreatingChain(false);
        }
    }

    const hasSubnet = !!subnetId;
    const canProceedToStep2 = hasSubnet && !!localChainName;
    const canProceedToStep3 = canProceedToStep2 && !!genesisData && genesisData !== "" && !genesisData.startsWith("Error:");
    const canCreateChain = canProceedToStep3;

    // Show warning if no subnet selected
    if (!hasSubnet) {
        return (
            <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="p-4 rounded-full bg-yellow-100 dark:bg-yellow-900/30 mb-4">
                    <AlertTriangle className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                </div>
                <h3 className="text-sm font-semibold text-center mb-2">No Subnet Selected</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                    Please go back to the previous step and create or select a subnet before configuring your chain.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Steps>
                {/* Step 1: Chain Configuration */}
                <Step>
                    <div>
                        <h2 className="text-sm font-semibold mb-1">Chain Configuration</h2>
                        <p className="text-xs text-muted-foreground">
                            Configure your chain name and virtual machine.
                        </p>
                    </div>
                    <ChainConfigStep
                        chainName={localChainName}
                        onChainNameChange={setLocalChainName}
                        vmId={vmId}
                        onVmIdChange={handleVmIdChange}
                    />
                </Step>

                {/* Step 2: Genesis Configuration */}
                <Step>
                    <div>
                        <h2 className="text-sm font-semibold mb-1">Genesis Configuration</h2>
                        <p className="text-xs text-muted-foreground">
                            {vmId === SUBNET_EVM_VM_ID
                                ? "Configure the genesis parameters for your chain."
                                : "Provide the genesis JSON for your custom virtual machine."}
                        </p>
                    </div>
                    {!canProceedToStep2 ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                                    Configure Chain First
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Please configure your chain name in Step 1 before proceeding.
                                </p>
                            </div>
                        </div>
                    ) : vmId === SUBNET_EVM_VM_ID ? (
                        // For Subnet-EVM, use the GenesisBuilder
                        <GenesisWizard
                            genesisData={genesisData}
                            onGenesisDataChange={setGenesisData}
                            embedded={embedded}
                        >
                            <GenesisBuilderInner
                                genesisData={genesisData}
                                setGenesisData={setGenesisData}
                                initiallyExpandedSections={["chainParams"]}
                            />
                        </GenesisWizard>
                    ) : (
                        // For custom VMs, provide a simple JSON input
                        <div className="space-y-4">
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                                <div className="flex items-start space-x-2">
                                    <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <div>
                                        <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Custom Virtual Machine</h4>
                                        <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                                            You're using a custom VM. Please provide your own genesis JSON configuration.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                                    Genesis JSON
                                </label>
                                <textarea
                                    className="w-full h-96 px-4 py-3 bg-zinc-900 dark:bg-zinc-950 text-zinc-100 rounded-lg border border-zinc-700 dark:border-zinc-800 font-mono text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder='{"config": {...}, "alloc": {...}, ...}'
                                    value={genesisData}
                                    onChange={(e) => setGenesisData(e.target.value)}
                                />
                                {genesisData && (() => {
                                    try {
                                        JSON.parse(genesisData);
                                        return (
                                            <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                                                ✓ Valid JSON ({(new Blob([genesisData]).size / 1024).toFixed(2)} KiB)
                                            </p>
                                        );
                                    } catch (e) {
                                        return (
                                            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                                                ✗ Invalid JSON: {(e as Error).message}
                                            </p>
                                        );
                                    }
                                })()}
                            </div>
                        </div>
                    )}
                </Step>

                {/* Step 3: Create Blockchain */}
                <Step>
                    <div>
                        <h2 className="text-sm font-semibold mb-1">Create Chain</h2>
                        <p className="text-xs text-muted-foreground">
                            Issues a{" "}
                            <Link
                                href="/docs/rpcs/p-chain/txn-format#unsigned-create-chain-tx"
                                className="text-primary hover:underline"
                            >
                                CreateChainTx
                            </Link>{" "}
                            on the P-Chain.
                        </p>
                    </div>
                    {!canProceedToStep3 ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                                    Configure Genesis First
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    Please complete the genesis configuration in Step 2 before creating your chain.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <CoreWalletTransactionButton
                            onClick={handleCreateChain}
                            loading={isCreatingChain}
                            loadingText="Creating Chain..."
                            disabled={!canCreateChain}
                            className="w-full"
                            cliCommand={`platform chain create --subnet-id ${subnetId || "<subnet-id>"} --genesis ./genesis.json --name "${localChainName}"${vmId !== SUBNET_EVM_VM_ID ? ` --vm-id ${vmId}` : ""} --network ${isTestnet ? "fuji" : "mainnet"}`}
                            downloadFile={genesisData ? { data: genesisData, filename: "genesis.json" } : undefined}
                        >
                            Create Chain
                        </CoreWalletTransactionButton>
                    )}
                </Step>
            </Steps>
        </div>
    );
}

export { CreateChain };
export default withConsoleToolMetadata(CreateChain, metadata);
