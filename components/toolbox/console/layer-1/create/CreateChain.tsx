"use client";

import { useCreateChainStore } from "@/components/toolbox/stores/createChainStore";
import { useState, useRef } from "react";
import { Button } from "@/components/toolbox/components/Button";
import { GenesisBuilderInner } from '@/components/toolbox/console/layer-1/create/GenesisBuilder';
import { Step, Steps } from "fumadocs-ui/components/steps";
import { SUBNET_EVM_VM_ID } from "@/constants/console";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";

// Import new Genesis Wizard components
import { GenesisWizard } from "@/components/toolbox/components/genesis/GenesisWizard";
import { SubnetStep } from "@/components/toolbox/components/genesis/SubnetStep";
import { ChainConfigStep, generateRandomChainName } from "@/components/toolbox/components/genesis/ChainConfigStep";

const metadata: ConsoleToolMetadata = {
    title: "Create Chain",
    description: "Create a subnet and add a new blockchain with custom parameters and genesis data",
    toolRequirements: [
        WalletRequirementsConfigKey.PChainBalance
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
    const setSubnetID = store(state => state.setSubnetID);
    const genesisData = store(state => state.genesisData);
    const setGenesisData = store(state => state.setGenesisData);
    const setChainName = store(state => state.setChainName);

    const { coreWalletClient } = useConnectedWallet();
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
        setIsCreatingChain(true);

        const createChainTx = coreWalletClient.createChain({
            chainName: localChainName,
            subnetId: subnetId,
            vmId,
            fxIds: [],
            genesisData: genesisData,
            subnetAuth: [0],
        })

        notify('createChain', createChainTx);

        try {
            const txID = await createChainTx;
            setChainID(txID);
            setChainName(localChainName);
            setLocalChainName(generateRandomChainName());

        } finally {
            setIsCreatingChain(false);
        }
    }

    const canProceedToStep2 = !!subnetId;
    const canProceedToStep3 = canProceedToStep2 && !!localChainName;
    const canProceedToStep4 = canProceedToStep3 && !!genesisData && genesisData !== "" && !genesisData.startsWith("Error:");
    const canCreateChain = canProceedToStep4;

    return (
        <div className="space-y-6">
            <Steps>
                {/* Step 1: Create Subnet */}
                <Step>
                    <SubnetStep
                        subnetId={subnetId}
                        onSubnetIdChange={setSubnetID}
                    />
                </Step>

                {/* Step 2: Chain Configuration */}
                <Step>
                    <div>
                        <h2 className="text-[14px] font-semibold mb-1">Chain Configuration</h2>
                        <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                            Configure your chain name and virtual machine.
                        </p>
                    </div>
                    {!canProceedToStep2 ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                                    Create or Select a Subnet First
                                </h3>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                    Please complete the subnet selection in Step 1 before proceeding.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <ChainConfigStep
                            chainName={localChainName}
                            onChainNameChange={setLocalChainName}
                            vmId={vmId}
                            onVmIdChange={handleVmIdChange}
                        />
                    )}
                </Step>

                {/* Step 3: Genesis Configuration */}
                <Step>
                    <div>
                        <h2 className="text-[14px] font-semibold mb-1">Genesis Configuration</h2>
                        <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                            {vmId === SUBNET_EVM_VM_ID 
                                ? "Configure the genesis parameters for your chain."
                                : "Provide the genesis JSON for your custom virtual machine."}
                        </p>
                    </div>
                    {!canProceedToStep3 ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                                    Configure Chain First
                                </h3>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                    Please configure your chain name and VM in Step 2 before proceeding.
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

                {/* Step 4: Create Chain */}
                <Step>
                    <div>
                        <h2 className="text-[14px] font-semibold mb-1">Create Chain</h2>
                        <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                            Create your chain by issuing a CreateChainTx transaction.
                        </p>
                    </div>
                    {!canProceedToStep4 ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                                    Configure Genesis First
                                </h3>
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                    Please complete the genesis configuration in Step 3 before creating your chain.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center py-12">
                            <Button
                                onClick={handleCreateChain}
                                loading={isCreatingChain}
                                loadingText="Creating Chain..."
                                disabled={!canCreateChain}
                                className="px-8"
                                size="lg"
                            >
                                Create Chain
                            </Button>
                        </div>
                    )}
                </Step>
            </Steps>
        </div>
    );
}

export { CreateChain };
export default withConsoleToolMetadata(CreateChain, metadata);