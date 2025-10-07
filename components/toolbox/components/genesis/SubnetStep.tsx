"use client";

import { useState } from "react";
import { Button } from "@/components/toolbox/components/Button";
import { Input } from "@/components/toolbox/components/Input";
import InputSubnetId from "@/components/toolbox/components/InputSubnetId";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";

interface SubnetStepProps {
    subnetId: string;
    onSubnetIdChange: (subnetId: string) => void;
}

export function SubnetStep({ subnetId, onSubnetIdChange }: SubnetStepProps) {
    const { pChainAddress } = useWalletStore();
    const { avalancheWalletClient } = useConnectedWallet();
    const { notify } = useConsoleNotifications();
    const [isCreatingSubnet, setIsCreatingSubnet] = useState(false);

    const handleCreateSubnet = async () => {
        setIsCreatingSubnet(true);

        const createSubnetTx = await avalancheWalletClient.pChain.prepareCreateSubnetTxn({
            subnetOwners: {
                addresses: [pChainAddress],
                threshold: 1,
            }
        });
        const txnResponse = avalancheWalletClient.sendXPTransaction(createSubnetTx);

        notify('createSubnet', txnResponse);

        try {
            const txID = await txnResponse;
            onSubnetIdChange(txID.txHash);
        } finally {
            setIsCreatingSubnet(false);
        }
    };

    return (
        <div className="space-y-6 text-[13px]">
            <div>
                <h2 className="text-[14px] font-semibold mb-1">Create or Select a Subnet</h2>
                <p className="text-[12px] text-zinc-500 dark:text-zinc-400">
                    Create a new Subnet or enter an existing Subnet ID.
                </p>
            </div>

            <div className="space-y-4">
                {/* Create New Subnet Option */}
                <div className="space-y-3">
                    <h3 className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Create New Subnet</h3>
                    <Input
                        label="Subnet Owner"
                        value={pChainAddress}
                        disabled={true}
                        type="text"
                    />
                    <Button
                        onClick={handleCreateSubnet}
                        loading={isCreatingSubnet}
                        loadingText="Creating Subnet..."
                        variant="primary"
                        className="w-full"
                    >
                        Create Subnet
                    </Button>
                </div>

                <div className="flex items-center gap-3 my-6">
                    <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800"></div>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">or</span>
                    <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800"></div>
                </div>

                {/* Use Existing Subnet Option */}
                <div className="space-y-3">
                    <h3 className="text-[13px] font-medium text-zinc-700 dark:text-zinc-300">Use Existing Subnet</h3>
                    <InputSubnetId
                        id="create-chain-subnet-id"
                        label=""
                        value={subnetId}
                        onChange={onSubnetIdChange}
                        validationDelayMs={3000}
                        hideSuggestions={true}
                        placeholder="Enter an existing Subnet ID"
                    />
                </div>
            </div>
        </div>
    );
}
