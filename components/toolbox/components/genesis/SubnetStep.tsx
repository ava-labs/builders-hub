"use client";

import { useState } from "react";
import { Button } from "@/components/toolbox/components/Button";
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
    const { coreWalletClient } = useConnectedWallet();
    const { notify } = useConsoleNotifications();
    const [isCreatingSubnet, setIsCreatingSubnet] = useState(false);

    async function handleCreateSubnet() {
        setIsCreatingSubnet(true);

        const createSubnetTx = coreWalletClient.createSubnet({
            subnetOwners: [pChainAddress]
        });

        notify('createSubnet', createSubnetTx);

        try {
            const txID = await createSubnetTx;
            onSubnetIdChange(txID);
        } finally {
            setIsCreatingSubnet(false);
        }
    }

    return (
        <div className="space-y-5 text-[13px]">
            <div>
                <h2 className="text-sm font-semibold mb-1">Subnet</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Create a new Subnet or use an existing one.
                </p>
            </div>

            <div className="space-y-4">
                <Button
                    onClick={handleCreateSubnet}
                    loading={isCreatingSubnet}
                    loadingText="Creating Subnet..."
                    variant="primary"
                    className="w-full"
                >
                    Create Subnet
                </Button>

                <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800"></div>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">or</span>
                    <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800"></div>
                </div>

                <InputSubnetId
                    id="create-chain-subnet-id"
                    label=""
                    value={subnetId}
                    onChange={onSubnetIdChange}
                    validationDelayMs={3000}
                    hideSuggestions={true}
                    placeholder="Enter existing Subnet ID"
                />
            </div>
        </div>
    );
}
