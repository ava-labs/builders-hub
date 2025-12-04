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
        <div className="space-y-12">
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
                        <h2 className="text-sm font-semibold mb-1">Chain Configuration</h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Configure your chain name and virtual machine.
                        </p>
                    </div>
                    {!canProceedToStep2 ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="text-center">
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                    Complete Step 1 to continue.
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
                        <h2 className="text-sm font-semibold mb-1">Genesis Configuration</h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {vmId === SUBNET_EVM_VM_ID 
                                ? "Configure the genesis parameters for your chain."
                                : "Provide the genesis JSON for your custom virtual machine."}
                        </p>
                    </div>
                    {!canProceedToStep3 ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="text-center">
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                    Complete Step 2 to continue.
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
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                Custom VM selected. Provide your genesis JSON below.
                            </p>
                            
                            <div>
                                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                                    Genesis JSON
                                </label>
                                <textarea
                                    className="w-full h-80 px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 rounded-lg border border-zinc-200 dark:border-zinc-800 font-mono text-xs resize-none focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 focus:border-transparent"
                                    placeholder='{"config": {...}, "alloc": {...}, ...}'
                                    value={genesisData}
                                    onChange={(e) => setGenesisData(e.target.value)}
                                />
                                {genesisData && (() => {
                                    try {
                                        JSON.parse(genesisData);
                                        return (
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">
                                                Valid JSON • {(new Blob([genesisData]).size / 1024).toFixed(2)} KiB
                                            </p>
                                        );
                                    } catch (e) {
                                        return (
                                            <p className="text-xs text-red-500 dark:text-red-400 mt-1.5">
                                                Invalid JSON: {(e as Error).message}
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
                        <h2 className="text-sm font-semibold mb-1">Review & Create</h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            Review your chain configuration and submit the CreateChainTx.
                        </p>
                    </div>
                    {!canProceedToStep4 ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="text-center">
                                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                    Complete Step 3 to continue.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {/* Overview */}
                            <div className="grid grid-cols-2 gap-4 text-[13px]">
                                <div>
                                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Chain Name</span>
                                    <p className="font-medium text-zinc-900 dark:text-zinc-100 mt-0.5">{localChainName}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Virtual Machine</span>
                                    <p className="font-medium text-zinc-900 dark:text-zinc-100 mt-0.5">
                                        {vmId === SUBNET_EVM_VM_ID ? 'Subnet-EVM' : 'Custom VM'}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Subnet ID</span>
                                    <p className="font-mono text-zinc-900 dark:text-zinc-100 mt-0.5 text-xs truncate" title={subnetId}>{subnetId}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Genesis Size</span>
                                    <p className="font-medium text-zinc-900 dark:text-zinc-100 mt-0.5">
                                        {(new Blob([genesisData]).size / 1024).toFixed(1)} KiB
                                    </p>
                                </div>
                            </div>

                            {/* Create Button */}
                            <div className="pt-2">
                                <Button
                                    onClick={handleCreateChain}
                                    loading={isCreatingChain}
                                    loadingText="Creating Chain..."
                                    disabled={!canCreateChain}
                                    className="w-full"
                                >
                                    Create Chain
                                </Button>
                            </div>
                        </div>
                    )}
                </Step>
            </Steps>
        </div>
    );
}

export { CreateChain };
export default withConsoleToolMetadata(CreateChain, metadata);