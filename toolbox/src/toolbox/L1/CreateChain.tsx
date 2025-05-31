"use client";

import { useCreateChainStore } from "../../stores/createChainStore";
import { useErrorBoundary } from "react-error-boundary";
import { useState, useEffect } from "react";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Container } from "../../components/Container";
import { useWalletStore } from "../../stores/walletStore";
import GenesisBuilder from "./GenesisBuilder";
import { Step, Steps } from "fumadocs-ui/components/steps";
import generateName from 'boring-name-generator'
import { Success } from "../../components/Success";
import { RadioGroup } from "../../components/RadioGroup";
import { getSubnetVMInfo, STANDARD_SUBNET_EVM_VM_ID, type SubnetVMAnalysis } from "../../coreViem/methods/getSubnetVMInfo";

export const EVM_VM_ID = "srEXiWaHuhNyGwPUi444Tu47ZEDwxTWrbQiuD7FmgSAQ6X7Dy"

const generateRandomName = () => {
    //makes sure the name doesn't contain a dash
    const firstLetterUppercase = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
    for (let i = 0; i < 1000; i++) {
        const randomName = generateName({ words: 3 }).raw.map(firstLetterUppercase).join(' ');
        if (!randomName.includes('-')) return randomName + " Chain";
    }
    throw new Error("Could not generate a name with a dash after 1000 attempts");
}


export default function CreateChain() {
    const { showBoundary } = useErrorBoundary();
    const {
        subnetId,
        chainName,
        setChainID,
        setSubnetID,
        genesisData,
        setChainName,
    } = useCreateChainStore()();
    const { coreWalletClient, pChainAddress } = useWalletStore();

    const [isCreatingSubnet, setIsCreatingSubnet] = useState(false);
    const [createdSubnetId, setCreatedSubnetId] = useState("");

    const [isCreatingChain, setIsCreatingChain] = useState(false);
    const [createdChainId, setCreatedChainId] = useState("");

    const [localGenesisData, setLocalGenesisData] = useState<string>(genesisData);
    const [localChainName, setLocalChainName] = useState<string>(generateRandomName());

    const [showVMIdInput, setShowVMIdInput] = useState<boolean>(false);
    const [vmId, setVmId] = useState<string>(EVM_VM_ID);

    // VM Analysis state
    const [vmAnalysis, setVmAnalysis] = useState<SubnetVMAnalysis | null>(null);
    const [isAnalyzingVMs, setIsAnalyzingVMs] = useState<boolean>(false);
    const [vmAnalysisError, setVmAnalysisError] = useState<string | null>(null);

    // VM Analysis effect
    useEffect(() => {
        if (!subnetId || !coreWalletClient) {
            setVmAnalysis(null);
            setVmAnalysisError(null);
            return;
        }

        // Don't analyze if this is a newly created subnet (likely empty)
        if (subnetId === createdSubnetId) {
            setVmAnalysis(null);
            setVmAnalysisError(null);
            return;
        }

        setIsAnalyzingVMs(true);
        setVmAnalysisError(null);

        getSubnetVMInfo(coreWalletClient, subnetId)
            .then((analysis) => {
                setVmAnalysis(analysis);

                // Auto-suggest VM based on analysis
                if (analysis.chains.length > 0) {
                    // If all chains use standard EVM, suggest standard EVM
                    if (!analysis.hasNonStandardVMs) {
                        setVmId(STANDARD_SUBNET_EVM_VM_ID);
                        setShowVMIdInput(false);
                    } else {
                        // If there are custom VMs, suggest the most common one or first custom VM
                        const customChains = analysis.chains.filter(c => !c.isStandardVM);
                        if (customChains.length > 0) {
                            setVmId(customChains[0].vmId);
                            setShowVMIdInput(true);
                        }
                    }
                }
            })
            .catch((error) => {
                console.error('Failed to analyze VM compatibility:', error);
                setVmAnalysisError(error.message);
            })
            .finally(() => {
                setIsAnalyzingVMs(false);
            });
    }, [subnetId, coreWalletClient, createdSubnetId]);

    async function handleCreateSubnet() {
        setIsCreatingSubnet(true);

        try {
            const txID = await coreWalletClient.createSubnet({
                subnetOwners: [pChainAddress]
            });

            setSubnetID(txID);
            setCreatedSubnetId(txID);
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsCreatingSubnet(false);
        }
    }

    async function handleCreateChain() {
        setIsCreatingChain(true);

        try {
            const txID = await coreWalletClient.createChain({
                chainName: chainName,
                subnetId: subnetId,
                vmId,
                fxIds: [],
                genesisData: localGenesisData,
                subnetAuth: [0],
            })

            setChainID(txID);
            setChainName(localChainName);

            setCreatedChainId(txID);

            setLocalChainName(generateRandomName());
        } catch (error) {
            showBoundary(error);
        } finally {
            setIsCreatingChain(false);
        }
    }

    return (
        <Container
            title="Create Chain"
            description="Create a new blockchain with custom parameters and genesis data."
        >
            <Steps>
                <Step>
                    <h2 className="text-lg font-semibold">Step 1: Create a Subnet</h2>
                    <p className="text-sm text-gray-500">
                        Every chain needs to be associated with a Subnet. If you don't have a Subnet, create one here. If you already have a Subnet, skip to the next step.
                    </p>
                    <div className="space-y-4">
                        <Input
                            label="Subnet Owner"
                            value={pChainAddress}
                            disabled={true}
                            type="text"
                        />
                        <Button
                            onClick={handleCreateSubnet}
                            loading={isCreatingSubnet}
                            variant="primary"
                        >
                            Create Subnet
                        </Button>
                    </div>
                    {createdSubnetId && (
                        <Success
                            label="Subnet Created Successfully"
                            value={createdSubnetId}
                        />
                    )}
                </Step>
                <Step>
                    <h2 className="text-lg font-semibold">Step 2: Create a Chain</h2>
                    <p className="text-sm text-gray-500">
                        Enter the parameters for your new chain.
                    </p>

                    <Input
                        label="Subnet ID"
                        value={subnetId}
                        type="text"
                        onChange={setSubnetID}
                        placeholder="Create a Subnet in Step 1 or enter a SubnetID."
                    />

                    {/* VM Analysis Feedback */}
                    {isAnalyzingVMs && (
                        <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <div className="flex items-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                                <span className="text-sm text-blue-800 dark:text-blue-200">Analyzing existing chains in subnet...</span>
                            </div>
                        </div>
                    )}

                    {vmAnalysisError && (
                        <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <p className="text-sm text-red-800 dark:text-red-200">
                                <strong>VM Analysis Error:</strong> {vmAnalysisError}
                            </p>
                        </div>
                    )}

                    {vmAnalysis && vmAnalysis.chains.length > 0 && (
                        <div className="mt-2 p-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg">
                            <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">Existing Chains in Subnet</h4>

                            {vmAnalysis.hasNonStandardVMs ? (
                                <div className="mb-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                        ⚠️ <strong>Mixed VM Types:</strong> This subnet contains chains with different Virtual Machines.
                                        Consider using the same VM as existing chains for consistency.
                                    </p>
                                </div>
                            ) : (
                                <div className="mb-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                                    <p className="text-sm text-green-800 dark:text-green-200">
                                        ✅ <strong>Consistent VMs:</strong> All existing chains use the standard Subnet-EVM.
                                        We recommend using the same VM for your new chain.
                                    </p>
                                </div>
                            )}

                            <div className="space-y-1">
                                {vmAnalysis.chains.map((chain) => (
                                    <div key={chain.blockchainId} className="text-xs text-zinc-600 dark:text-zinc-400">
                                        <span className="font-mono">{chain.blockchainName || 'Unknown'}</span>
                                        {!chain.isStandardVM && (
                                            <span className="ml-2 text-yellow-600 dark:text-yellow-400">
                                                (Custom VM: {chain.vmId.slice(0, 12)}...)
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <Input
                        label="Chain Name"
                        value={localChainName}
                        onChange={setLocalChainName}
                        placeholder="Enter chain name"
                    />

                    <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Virtual Machine</h3>
                    <p className="text-sm text-gray-500">
                        Select what Virtual Machine (VM) your chain will use.
                    </p>
                    <RadioGroup
                        value={showVMIdInput ? 'true' : 'false'}
                        onChange={(value) => {
                            const shouldShow = value === "true";
                            setShowVMIdInput(shouldShow);
                            // Reset to standard EVM when switching to uncustomized
                            if (!shouldShow) {
                                setVmId(EVM_VM_ID);
                            }
                        }}
                        idPrefix={`show-vm-id`}
                        className="mb-4"
                        items={[
                            { value: "false", label: "Uncustomized EVM" },
                            { value: "true", label: "Customized EVM or alternative VM (Experts only)" }
                        ]}
                    />
                    {showVMIdInput && (
                        <Input
                            label="VM ID"
                            value={vmId}
                            onChange={setVmId}
                            placeholder="Enter VM ID"
                            helperText={`For an L1 with an uncustomized EVM use ${EVM_VM_ID}`}
                        />
                    )}

                    <GenesisBuilder genesisData={localGenesisData} setGenesisData={setLocalGenesisData} />

                    <Button
                        onClick={handleCreateChain}
                        loading={isCreatingChain}
                        loadingText="Creating Chain..."
                    >
                        Create Chain
                    </Button>
                </Step>
            </Steps>
            {createdChainId && <Success
                label="Chain Created Successfully"
                value={createdChainId}
            />}
        </Container>
    );
};
