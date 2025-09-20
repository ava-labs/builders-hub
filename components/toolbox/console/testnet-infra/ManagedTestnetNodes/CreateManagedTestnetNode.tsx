"use client";

import { useState, useEffect } from "react";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
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
import TestnetOnly from "./TestnetOnly";
import { ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";

const metadata: ConsoleToolMetadata = {
    title: "Create Managed Testnet Node",
    description: "Spin up a free testnet node. You need a Builder Hub Account to use this tool.",
    walletRequirements: []
};

function CreateManagedTestnetNodeBase() {
    const { isTestnet } = useWalletStore();
    const { createNode, fetchNodes, nodes } = useManagedTestnetNodes();
    const { addChain } = useWallet();
    const { notify } = useConsoleNotifications();

    const [subnetId, setSubnetId] = useState("");
    const [selectedBlockchainId, setSelectedBlockchainId] = useState("");
    const [subnet, setSubnet] = useState<any>(null);
    const [createdResponse, setCreatedResponse] = useState<RegisterSubnetResponse | null>(null);
    const [createdNode, setCreatedNode] = useState<NodeRegistration | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [secondsUntilWalletEnabled, setSecondsUntilWalletEnabled] = useState<number>(0);
    const [isConnecting, setIsConnecting] = useState(false);

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
        setIsCreating(true);
        const createNodePromise = createNode(subnetId, selectedBlockchainId);
        notify({
            name: "Managed Testnet Node Creation",
            type: "local"
        }, createNodePromise);
        try {
        const response = await createNodePromise;
        setCreatedResponse(response);
        } finally{
            setIsCreating(false);
            await fetchNodes();
        }
    };

    const handleAddToWallet = async () => {
        if (!createdNode) return;
        setIsConnecting(true);
        await addChain({
            rpcUrl: createdNode.rpc_url,
            allowLookup: false
        });
        setIsConnecting(false);
    };

    if (!isTestnet) {
        return <TestnetOnly />;
    }

    return (
        <div className="p-8">
            <div className="flex justify-end mb-6">
                <Link href="/console/testnet-infra/nodes" className="text-blue-600 hover:underline">
                    View all managed nodes
                </Link>
            </div>
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
                            setSubnet(selection.subnet);
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
                        loading={isCreating}
                        disabled={!subnetId || !selectedBlockchainId || isCreating}
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
                        disabled={!createdNode || secondsUntilWalletEnabled > 0 || isConnecting}
                        loading={isConnecting}
                    >
                        <Wallet className="mr-2 h-4 w-4" />
                        {secondsUntilWalletEnabled > 0
                            ? `Wait ${secondsUntilWalletEnabled}s`
                            : "Add to Wallet"}
                    </Button>
                </Step>
            </Steps>
        </div>
    );
}

export default withConsoleToolMetadata(CreateManagedTestnetNodeBase, metadata);
