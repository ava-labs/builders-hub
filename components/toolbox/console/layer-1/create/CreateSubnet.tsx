"use client";

import { useState } from "react";
import { useCreateChainStore } from "@/components/toolbox/stores/createChainStore";
import { Button } from "@/components/toolbox/components/Button";
import { Input } from "@/components/toolbox/components/Input";
import InputSubnetId from "@/components/toolbox/components/InputSubnetId";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useConnectedWallet } from "@/components/toolbox/contexts/ConnectedWalletContext";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { BaseConsoleToolProps, ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { ExternalLink, BookOpen, GraduationCap } from "lucide-react";
import Link from "next/link";
import { CliAlternative } from "@/components/console/cli-alternative";

const metadata: ConsoleToolMetadata = {
    title: "Create Subnet",
    description: "Create a new Subnet or select an existing one to build your L1 on",
    toolRequirements: [
        WalletRequirementsConfigKey.PChainBalance
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function CreateSubnet(_props: BaseConsoleToolProps) {
    const store = useCreateChainStore();
    const subnetId = store(state => state.subnetId);
    const setSubnetID = store(state => state.setSubnetID);

    const { pChainAddress, isTestnet } = useWalletStore();
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
            setSubnetID(txID);
        } finally {
            setIsCreatingSubnet(false);
        }
    }

    return (
        <div className="space-y-6">
            {/* Context Box */}
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
                <p className="mb-3">
                    A <strong>Subnet</strong> is a sovereign network that defines its own rules for membership and token economics.
                    Every Avalanche L1 blockchain is validated by exactly one Subnet.
                </p>
                <div className="flex flex-wrap gap-3">
                    <Link
                        href="/docs/avalanche-l1s"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                    >
                        <BookOpen className="h-3 w-3" />
                        L1 Documentation
                        <ExternalLink className="h-3 w-3" />
                    </Link>
                    <Link
                        href="/academy/avalanche-l1/avalanche-fundamentals"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                    >
                        <GraduationCap className="h-3 w-3" />
                        Fundamentals Course
                        <ExternalLink className="h-3 w-3" />
                    </Link>
                </div>
            </div>

            {/* Main Content - Two Column on Desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Create New */}
                <div className="p-5 rounded-lg border bg-card">
                    <h3 className="text-sm font-medium mb-3">Create New Subnet</h3>
                    <div className="space-y-3">
                        <Input
                            label="Owner (your P-Chain address)"
                            value={pChainAddress}
                            disabled={true}
                            type="text"
                        />
                        <p className="text-xs text-muted-foreground">
                            Issues a{" "}
                            <Link
                                href="/docs/rpcs/p-chain/txn-format#unsigned-create-subnet-tx"
                                className="text-primary hover:underline"
                            >
                                CreateSubnetTx
                            </Link>{" "}
                            on the P-Chain.
                        </p>
                        <Button
                            onClick={handleCreateSubnet}
                            loading={isCreatingSubnet}
                            loadingText="Creating..."
                            variant="primary"
                            icon={<img src="/images/core.svg" alt="" className="w-4 h-4" />}
                            className="w-full"
                        >
                            Create Subnet
                        </Button>
                    </div>
                </div>

                {/* Use Existing */}
                <div className="p-5 rounded-lg border bg-card">
                    <h3 className="text-sm font-medium mb-3">Use Existing Subnet</h3>
                    <InputSubnetId
                        id="create-subnet-id"
                        label=""
                        value={subnetId}
                        onChange={setSubnetID}
                        validationDelayMs={3000}
                        hideSuggestions={true}
                        placeholder="Enter Subnet ID"
                    />
                </div>
            </div>

            <CliAlternative command={`platform subnet create --network ${isTestnet ? "fuji" : "mainnet"}`} />
        </div>
    );
}

export { CreateSubnet };
export default withConsoleToolMetadata(CreateSubnet, metadata);
