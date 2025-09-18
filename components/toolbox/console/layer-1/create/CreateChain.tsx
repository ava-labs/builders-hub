"use client";

import { useCreateChainStore } from "@/components/toolbox/stores/createChainStore";
import { useState } from "react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { SUBNET_EVM_VM_ID } from "@/constants/console";
import { CheckWalletRequirements } from "@/components/toolbox/components/CheckWalletRequirements";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import generateName from 'boring-name-generator'
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { Steps, Step } from 'fumadocs-ui/components/steps';
import { ValidationMessages } from '@/components/toolbox/components/genesis/types';

// Import UI components
import {
    CreateChainHeader,
    SubnetConfiguration,
    ChainNameConfiguration,
    GenesisConfiguration,
    GenesisJsonViewer,
    CreateChainButton
} from './components';


const generateRandomName = () => {
    //makes sure the name doesn't contain a dash
    const firstLetterUppercase = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
    for (let i = 0; i < 1000; i++) {
        const randomName = generateName({ words: 2 }).raw.map(firstLetterUppercase).join(' ');
        if (!randomName.includes('-')) return randomName + " Chain";
    }
    throw new Error("Could not generate a name with a dash after 1000 attempts");
}


interface CreateChainProps {
    embedMode?: boolean; // true when embedded in MDX, false for console
}

export default function CreateChain({ embedMode = false }: CreateChainProps) {
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
    const [isEditMode, setIsEditMode] = useState(false);
    const [validationMessages, setValidationMessages] = useState<ValidationMessages>({ errors: {}, warnings: {} });

    // Default to standard EVM
    const vmId = SUBNET_EVM_VM_ID;

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

    if (embedMode) {
        // MDX Embed Mode - Single Column Layout with Steps
        return (
            <CheckWalletRequirements configKey={[
                WalletRequirementsConfigKey.PChainBalance
            ]}>
                <div className="flex flex-col">
                    <CreateChainHeader />
                    
                    <div className="w-full px-4 py-4 space-y-4">
                        <Steps>
                            <Step>
                                <SubnetConfiguration
                                    subnetId={subnetId}
                                    isCreatingSubnet={isCreatingSubnet}
                                    onCreateSubnet={handleCreateSubnet}
                                    onSubnetIdChange={handleSubnetIdChange}
                                    embedMode={true}
                                />
                            </Step>

                            <Step>
                                <ChainNameConfiguration
                                    chainName={localChainName}
                                    onChainNameChange={setLocalChainName}
                                    embedMode={true}
                                />
                            </Step>

                            <Step>
                                <GenesisConfiguration
                                    genesisData={localGenesisData}
                                    isEditMode={isEditMode}
                                    onGenesisDataChange={setLocalGenesisData}
                                    embedMode={true}
                                    onValidationChange={setValidationMessages}
                                />
                            </Step>
                        </Steps>

                        <GenesisJsonViewer
                            genesisData={localGenesisData}
                            chainName={localChainName}
                            isEditMode={isEditMode}
                            onEditModeToggle={() => setIsEditMode(!isEditMode)}
                            onGenesisDataChange={setLocalGenesisData}
                            embedMode={true}
                            validationMessages={validationMessages}
                        />
                        
                        <CreateChainButton
                            subnetId={subnetId}
                            genesisData={localGenesisData}
                            isCreating={isCreatingChain}
                            onClick={handleCreateChain}
                            embedMode={true}
                        />
                    </div>
                </div>
            </CheckWalletRequirements>
        );
    }

    // Console Mode - Subnet config on top, then two-panel layout
    return (
        <CheckWalletRequirements configKey={[
            WalletRequirementsConfigKey.PChainBalance
        ]}>
            <div className="flex flex-col h-screen">
                <CreateChainHeader />

                {/* Step 1: Subnet Configuration - Full width at top */}
                <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-semibold">
                            1
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-zinc-900 dark:text-white">Subnet Configuration</h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Create or select a subnet</p>
                        </div>
                    </div>
                    <SubnetConfiguration
                        subnetId={subnetId}
                        isCreatingSubnet={isCreatingSubnet}
                        onCreateSubnet={handleCreateSubnet}
                        onSubnetIdChange={handleSubnetIdChange}
                        embedMode={false}
                    />
                </div>

                {/* Two-Panel Layout for Steps 2 & 3 */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Left Panel - Chain Name and Genesis Configuration */}
                    <div className="w-2/5 border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto">
                        <div className="p-4 space-y-4">
                            {/* Step 2: Chain Name */}
                            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-semibold">
                                        2
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium text-zinc-900 dark:text-white">Chain Name</h3>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Name your blockchain</p>
                                    </div>
                                </div>
                                <ChainNameConfiguration
                                    chainName={localChainName}
                                    onChainNameChange={setLocalChainName}
                                    embedMode={false}
                                />
                            </div>

                            {/* Step 3: Genesis Parameters */}
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-semibold">
                                        3
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-medium text-zinc-900 dark:text-white">Genesis Configuration</h3>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Configure blockchain parameters</p>
                                    </div>
                                </div>
                                <GenesisConfiguration
                                    genesisData={localGenesisData}
                                    isEditMode={isEditMode}
                                    onGenesisDataChange={setLocalGenesisData}
                                    embedMode={false}
                                    onValidationChange={setValidationMessages}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Panel - Genesis JSON Preview */}
                    <GenesisJsonViewer
                        genesisData={localGenesisData}
                        chainName={localChainName}
                        isEditMode={isEditMode}
                        onEditModeToggle={() => setIsEditMode(!isEditMode)}
                        onGenesisDataChange={setLocalGenesisData}
                        embedMode={false}
                        subnetId={subnetId}
                        isCreatingChain={isCreatingChain}
                        onCreateChain={handleCreateChain}
                        validationMessages={validationMessages}
                    />
                </div>
            </div>
        </CheckWalletRequirements>
    );
};