"use client";

import { useState } from "react";
import { Input } from "@/components/toolbox/components/Input";
import { RadioGroup } from "@/components/toolbox/components/RadioGroup";
import { Select } from "@/components/toolbox/components/Select";
import { SUBNET_EVM_VM_ID } from "@/constants/console";
import generateName from 'boring-name-generator';

interface ChainConfigStepProps {
    chainName: string;
    onChainNameChange: (name: string) => void;
    vmId: string;
    onVmIdChange: (id: string) => void;
}

export const generateRandomChainName = () => {
    const firstLetterUppercase = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
    
    try {
        for (let i = 0; i < 1000; i++) {
            const result = generateName({ words: 2 });
            if (result && result.raw && Array.isArray(result.raw)) {
                const randomName = result.raw.map(firstLetterUppercase).join(' ');
                if (!randomName.includes('-')) {
                    return randomName + " Chain";
                }
            }
        }
    } catch (error) {
        console.error('Error generating name:', error);
    }
    
    // Fallback to a simple random name if unable to generate one or if there's an error
    return "Chain " + Math.floor(Math.random() * 10000);
};

export function ChainConfigStep({ chainName, onChainNameChange, vmId, onVmIdChange }: ChainConfigStepProps) {
    const [showVMIdInput, setShowVMIdInput] = useState<boolean>(vmId !== SUBNET_EVM_VM_ID);

    const handleVMTypeChange = (value: string) => {
        const shouldShow = value === "true";
        setShowVMIdInput(shouldShow);
        // Reset to standard EVM when switching to uncustomized
        if (!shouldShow) {
            onVmIdChange(SUBNET_EVM_VM_ID);
        }
    };

    const handleGenerateRandomName = () => {
        const newName = generateRandomChainName();
        onChainNameChange(newName);
    };

    return (
        <div className="space-y-5 text-[13px]">
            <div className="space-y-4">
                {/* Chain Name */}
                <div>
                    <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                            Chain Name
                        </label>
                        <button
                            type="button"
                            onClick={handleGenerateRandomName}
                            className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors cursor-pointer"
                            style={{ pointerEvents: 'auto' }}
                        >
                            Randomize
                        </button>
                    </div>
                    <Input
                        label=""
                        value={chainName}
                        onChange={onChainNameChange}
                        placeholder="Enter chain name"
                        className="w-full"
                    />
                </div>

                {/* Virtual Machine Selection */}
                <div className="space-y-3">
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        Virtual Machine
                    </label>
                    <Select
                        label=""
                        value={showVMIdInput ? 'custom' : 'standard'}
                        onChange={(val) => handleVMTypeChange((val as string) === 'custom' ? 'true' : 'false')}
                        options={[
                            { 
                                label: 'Subnet-EVM (Ethereum Compatible)', 
                                value: 'standard'
                            },
                            { 
                                label: 'Custom Virtual Machine', 
                                value: 'custom' 
                            }
                        ]}
                        className="w-full"
                    />
                    
                    {/* Custom VM ID Input */}
                    {showVMIdInput && (
                        <div className="space-y-2 pt-2">
                            <Input
                                label="Custom VM ID"
                                value={vmId}
                                onChange={onVmIdChange}
                                placeholder={SUBNET_EVM_VM_ID}
                                className="font-mono text-sm"
                            />
                            <p className="text-xs text-zinc-400 dark:text-zinc-500">
                                Enter a custom VM ID
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
