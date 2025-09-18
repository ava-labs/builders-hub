"use client";

import { useCreateChainStore } from "@/components/toolbox/stores/createChainStore";
import { useState } from "react";
import { Button } from "@/components/toolbox/components/Button";
import { Input } from "@/components/toolbox/components/Input";
import { Container } from "@/components/toolbox/components/Container";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import GenesisBuilder from '@/components/toolbox/console/layer-1/create/GenesisBuilder';
import { Step, Steps } from "fumadocs-ui/components/steps";
import generateName from 'boring-name-generator'
import { RadioGroup } from "@/components/toolbox/components/RadioGroup";
import InputSubnetId from "@/components/toolbox/components/InputSubnetId";
import { SUBNET_EVM_VM_ID } from "@/constants/console";
import { CheckWalletRequirements } from "@/components/toolbox/components/CheckWalletRequirements";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { useWallet } from "@/components/toolbox/hooks/useWallet";

import useConsoleNotifications from "@/hooks/useConsoleNotifications";


const generateRandomName = () => {
    //makes sure the name doesn't contain a dash
    const firstLetterUppercase = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
    for (let i = 0; i < 1000; i++) {
        const randomName = generateName({ words: 2 }).raw.map(firstLetterUppercase).join(' ');
        if (!randomName.includes('-')) return randomName + " Chain";
    }
    throw new Error("Could not generate a name with a dash after 1000 attempts");
}


export default function CreateChain() {
    const {
        subnetId,
        setChainID,
        setSubnetID,
        genesisData,
        setChainName,
    } = useCreateChainStore()();
    const { coreWalletClient, pChainAddress, isTestnet } = useWalletStore();

    const [isCreatingSubnet, setIsCreatingSubnet] = useState(false);
    const [isCreatingChain, setIsCreatingChain] = useState(false);

    const [localGenesisData, setLocalGenesisData] = useState<string>(genesisData);
    const [localChainName, setLocalChainName] = useState<string>(generateRandomName());

    const [showVMIdInput, setShowVMIdInput] = useState<boolean>(false);
    const [vmId, setVmId] = useState<string>(SUBNET_EVM_VM_ID);

    const { notify, sendCoreWalletNotSetNotification } = useConsoleNotifications();


    // Wrapper function to handle subnet ID changes properly
    const handleSubnetIdChange = (newSubnetId: string) => {
        setSubnetID(newSubnetId);
    };

    async function handleCreateSubnet() {
        if (!coreWalletClient) {
            sendCoreWalletNotSetNotification();
            return;
        }


        setIsCreatingSubnet(true);

        const createSubnetTx = coreWalletClient.createSubnet({
            subnetOwners: [pChainAddress]
        });

        notify('createSubnet', createSubnetTx);

        try {
            const txID = await createSubnetTx;
            setSubnetID(txID);
        } finally {
            setIsCreatingSubnet(false);
        }
    }

    async function handleCreateChain() {
        if (!coreWalletClient) {
            sendCoreWalletNotSetNotification();
            return;
        }


        setIsCreatingChain(true);

        const createChainTx = coreWalletClient.createChain({
            chainName: localChainName,
            subnetId: subnetId,
            vmId,
            fxIds: [],
            genesisData: localGenesisData,
            subnetAuth: [0],
        })

        notify('createChain', createChainTx);

        try {
            const txID = await createChainTx;
            setChainID(txID);
            setChainName(localChainName);
            setLocalChainName(generateRandomName());

        } finally {
            setIsCreatingChain(false);
        }
    }

    return (
        <CheckWalletRequirements configKey={[
            WalletRequirementsConfigKey.PChainBalance
        ]}>
            <Container
                title="Create Chain"
                description="Create a subnet and add a new blockchain with custom parameters and genesis data."
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
                    </Step>
                    <Step>
                        <h2 className="text-lg font-semibold">Step 2: Create a Chain</h2>
                        <p className="text-sm text-gray-500">
                            Enter the parameters for your new chain.
                        </p>

                        <InputSubnetId
                            id="create-chain-subnet-id"
                            label="Subnet ID"
                            value={subnetId}
                            onChange={handleSubnetIdChange}
                            validationDelayMs={3000}
                            hideSuggestions={true}
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
                            onChange={(value) => {
                                const shouldShow = value === "true";
                                setShowVMIdInput(shouldShow);
                                // Reset to standard EVM when switching to uncustomized
                                if (!shouldShow) {
                                    setVmId(SUBNET_EVM_VM_ID);
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
                                helperText={`For an L1 with an uncustomized EVM use ${SUBNET_EVM_VM_ID}`}
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
            </Container>
        </CheckWalletRequirements>
    );
};
