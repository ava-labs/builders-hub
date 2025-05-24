"use client";

import { useCreateChainStore } from "../../stores/createChainStore";
import { useErrorBoundary } from "react-error-boundary";
import { useState } from "react";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Container } from "../../components/Container";
import { useWalletStore } from "../../stores/walletStore";
import GenesisBuilder from "./GenesisBuilder";
import { Step, Steps } from "fumadocs-ui/components/steps";
import generateName from 'boring-name-generator'
import { Success } from "../../components/Success";
import { RadioGroup } from "../../components/RadioGroup";

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
                        onChange={(value) => setShowVMIdInput(value === "true")}
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
