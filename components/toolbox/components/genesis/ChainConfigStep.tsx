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
        <div className="space-y-6 text-[13px]">
            <div className="space-y-4">
                {/* Chain Name */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            Chain Name
                        </label>
                        <button
                            type="button"
                            onClick={handleGenerateRandomName}
                            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors cursor-pointer active:scale-95"
                            style={{ pointerEvents: 'auto' }}
                        >
                            Generate Random
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
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            Virtual Machine
                        </label>
                        {!showVMIdInput && (
                            <span className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                                {SUBNET_EVM_VM_ID.slice(0, 8)}...
                            </span>
                        )}
                    </div>
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
                        <div className="space-y-2 p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-800">
                            <Input
                                label="Custom VM ID"
                                value={vmId}
                                onChange={onVmIdChange}
                                placeholder={SUBNET_EVM_VM_ID}
                                className="font-mono text-sm"
                            />
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                Enter a custom VM ID or use the standard Subnet-EVM ID above
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
