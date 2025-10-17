"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/toolbox/components/Button";
import { useManagedTestnetNodes } from "@/hooks/useManagedTestnetNodes";
import { NodeRegistration, RegisterSubnetResponse } from "./types";
import { useWallet } from "@/components/toolbox/hooks/useWallet";
import { Wallet, X } from "lucide-react";
import { Steps, Step } from 'fumadocs-ui/components/steps';
import Link from 'next/link';
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock';
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import SelectSubnet from "@/components/toolbox/components/SelectSubnet";
import { ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import { WalletRequirementsConfigKey } from "@/components/toolbox/hooks/useWalletRequirements";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";
import { AccountRequirementsConfigKey } from "@/components/toolbox/hooks/useAccountRequirements";

const metadata: ConsoleToolMetadata = {
    title: "Create Managed Testnet Node",
    description: "An L1 is a network of Avalanche nodes. To make it easy to play around with L1s, we created this tool to spin up a free testnet node. These nodes will shut down after 3 days. They are suitable for quick testing. For production settings or extended testing, see the self-hosted below. You need a Builder Hub Account to use this tool.",
    toolRequirements: [
        WalletRequirementsConfigKey.TestnetRequired,
        AccountRequirementsConfigKey.UserLoggedIn
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function CreateManagedTestnetNodeBase() {
    const { createNode, fetchNodes, nodes } = useManagedTestnetNodes();
    const { addChain } = useWallet();
    const { notify } = useConsoleNotifications();

    const [subnetId, setSubnetId] = useState("");
    const [selectedBlockchainId, setSelectedBlockchainId] = useState("");

    const [createdResponse, setCreatedResponse] = useState<RegisterSubnetResponse | null>(null);
    const [createdNode, setCreatedNode] = useState<NodeRegistration | null>(null);
    const [isCreatingNode, setIsCreatingNode] = useState(false);

    const [secondsUntilWalletEnabled, setSecondsUntilWalletEnabled] = useState<number>(0);
    const [isConnectingWallet, setIsConnectingWallet] = useState(false);

    useEffect(() => {
        if (createdResponse && nodes.length > 0) {
            const node = nodes.find(n => n.node_id === createdResponse.nodeID && n.subnet_id === subnetId);
            if (node) {
                setCreatedNode(node);
            }
        }
    }, [nodes, createdResponse, subnetId]);

    useEffect(() => {
        if (!createdNode) return;
        const createdAtMs = new Date(createdNode.created_at).getTime();
        const elapsedSeconds = Math.floor((Date.now() - createdAtMs) / 1000);
        const initialRemaining = Math.max(0, 10 - elapsedSeconds);
        setSecondsUntilWalletEnabled(initialRemaining);

        if (initialRemaining === 0) return;

        const intervalId = setInterval(() => {
            setSecondsUntilWalletEnabled(prev => {
                if (prev <= 1) {
                    clearInterval(intervalId);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(intervalId);
    }, [createdNode]);

    const handleCreate = async () => {
        setIsCreatingNode(true);
        const createNodePromise = createNode(subnetId, selectedBlockchainId);
        notify({
            name: "Managed Testnet Node Creation",
            type: "local"
        }, createNodePromise);
        try {
            const response = await createNodePromise;
            setCreatedResponse(response);
        } finally {
            setIsCreatingNode(false);
            await fetchNodes();
        }
    };

    const handleAddToWallet = async () => {
        if (!createdNode) return;
        setIsConnectingWallet(true);
        await addChain({
            rpcUrl: createdNode.rpc_url,
            allowLookup: false
        });
        setIsConnectingWallet(false);
    };

    return (
        <Steps>
            <Step>
                <h2 className="text-lg font-semibold">Step 1: Select Subnet</h2>
                <p className="text-sm text-gray-500 mb-8">
                    Enter the Subnet ID of the blockchain you want to create a node for.
                </p>
                <SelectSubnet
                    value={subnetId}
                    onChange={(selection) => {
                        setSubnetId(selection.subnetId);
                        setSelectedBlockchainId(selection.subnet?.blockchains?.[0]?.blockchainId || '');
                    }}
                />
            </Step>

            <Step>
                <h2 className="text-lg font-semibold">Step 2: Create Node</h2>
                <p className="text-sm text-gray-500 mb-8">
                    Review the details and create your managed testnet node.
                </p>
                <Button
                    onClick={handleCreate}
                    loading={isCreatingNode}
                    disabled={!subnetId || !selectedBlockchainId || isCreatingNode}
                >
                    Create Node
                </Button>
            </Step>

            <Step>
                <h2 className="text-lg font-semibold">Step 3: Add to Wallet</h2>
                <p className="text-sm text-gray-500 mb-8">
                    Add the new node's RPC to your wallet.
                </p>
                {createdNode && (
                    <div className="mb-6">
                        <p className="mb-2">RPC URL:</p>
                        <CodeBlock allowCopy>
                            <Pre>{createdNode.rpc_url}</Pre>
                        </CodeBlock>
                    </div>
                )}
                <Button
                    onClick={handleAddToWallet}
                    disabled={!createdNode || secondsUntilWalletEnabled > 0 || isConnectingWallet}
                    loading={isConnectingWallet}
                >
                    <Wallet className="mr-2 h-4 w-4" />
                    {secondsUntilWalletEnabled > 0
                        ? `Wait ${secondsUntilWalletEnabled}s`
                        : "Add to Wallet"}
                </Button>
            </Step>
            <Step>
                <h2 className="text-lg font-semibold">Step 4: Open Testnet Node Manager</h2>
                <p className="text-sm text-gray-500 mb-8">
                    To view this node and other that you have created, open the Testnet Node Manager.
                </p>
                <Link href="/console/testnet-infra/nodes" target="_blank">
                    <Button
                        disabled={!createdNode}
                    >Open Testnet Node Manager</Button>
                </Link>
            </Step>
        </Steps>
    );
}

export default withConsoleToolMetadata(CreateManagedTestnetNodeBase, metadata);
