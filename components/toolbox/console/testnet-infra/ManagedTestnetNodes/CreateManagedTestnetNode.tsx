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
import { SUBNET_EVM_VM_ID } from "@/constants/console";
import { Subnet } from "@avalanche-sdk/chainkit/models/components/subnet.js";
import { AlertTriangle } from "lucide-react";

const metadata: ConsoleToolMetadata = {
    title: "Create Managed Testnet Node",
    description: "An L1 is a network of Avalanche nodes. To make it easy to play around with L1s, we created this tool to spin up a free testnet node. These nodes will shut down after 3 days. They are suitable for quick testing. For production settings or extended testing, see the self-hosted below. You need a Builder Hub Account to use this tool.",
    toolRequirements: [
        WalletRequirementsConfigKey.TestnetRequired,
        AccountRequirementsConfigKey.UserLoggedIn
    ],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

// Maximum number of active nodes per user
const MAX_USER_NODES = 3;

function CreateManagedTestnetNodeBase() {
    const { createNode, fetchNodes, nodes, checkExistingNode } = useManagedTestnetNodes();
    const { addChain } = useWallet();
    const { notify } = useConsoleNotifications();

    const [subnetId, setSubnetId] = useState("");
    const [selectedBlockchainId, setSelectedBlockchainId] = useState("");
    const [selectedSubnet, setSelectedSubnet] = useState<Subnet | null>(null);

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

    // Pre-flight validation checks
    const selectedVmId = selectedSubnet?.blockchains?.[0]?.vmId;
    const isUnsupportedVm = selectedVmId && selectedVmId !== SUBNET_EVM_VM_ID;
    const activeNodeCount = nodes.filter(n => n.status === 'active').length;
    const hasMaxNodes = activeNodeCount >= MAX_USER_NODES;
    const existingNodeForSubnet = subnetId ? checkExistingNode(subnetId) : null;

    // Determine if creation should be blocked
    const canCreate = subnetId && selectedBlockchainId && !isUnsupportedVm && !hasMaxNodes && !existingNodeForSubnet && !isCreatingNode;

    const handleCreate = async () => {
        // Final pre-flight checks before API call
        if (isUnsupportedVm) {
            notify({
                name: "Managed Testnet Node Creation",
                type: "local"
            }, Promise.reject(new Error(
                `This blockchain uses a custom VM that is not supported. ` +
                `Only Subnet EVM blockchains can use managed testnet nodes. ` +
                `For custom VMs, please run your own validator node.`
            )));
            return;
        }

        if (hasMaxNodes) {
            notify({
                name: "Managed Testnet Node Creation",
                type: "local"
            }, Promise.reject(new Error(
                `You already have ${MAX_USER_NODES} active nodes (maximum allowed). ` +
                `Please delete an existing node or wait for one to expire before creating a new one.`
            )));
            return;
        }

        if (existingNodeForSubnet) {
            notify({
                name: "Managed Testnet Node Creation",
                type: "local"
            }, Promise.reject(new Error(
                `You already have an active node for this subnet. ` +
                `Each user can only have one node per subnet.`
            )));
            return;
        }

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
                        setSelectedSubnet(selection.subnet);
                    }}
                />

                {/* Pre-flight warning: Unsupported VM */}
                {isUnsupportedVm && (
                    <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium text-yellow-800 dark:text-yellow-200">Unsupported VM Type</p>
                            <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                                This blockchain uses a custom VM (<code className="text-xs bg-yellow-100 dark:bg-yellow-800 px-1 rounded">{selectedVmId?.slice(0, 12)}...</code>) which is not supported by managed testnet nodes.
                                Only <strong>Subnet EVM</strong> blockchains are supported. For custom VMs, you'll need to run your own validator node.
                            </p>
                        </div>
                    </div>
                )}

                {/* Pre-flight warning: Existing node for subnet */}
                {existingNodeForSubnet && (
                    <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium text-blue-800 dark:text-blue-200">Node Already Exists</p>
                            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                                You already have an active node for this subnet. Each user can only have one node per subnet.
                                <Link href="/console/testnet-infra/nodes" className="ml-1 underline hover:no-underline">
                                    View your nodes →
                                </Link>
                            </p>
                        </div>
                    </div>
                )}
            </Step>

            <Step>
                <h2 className="text-lg font-semibold">Step 2: Create Node</h2>
                <p className="text-sm text-gray-500 mb-4">
                    Review the details and create your managed testnet node.
                </p>

                {/* Pre-flight warning: Max nodes reached */}
                {hasMaxNodes && (
                    <div className="mb-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-medium text-orange-800 dark:text-orange-200">Node Limit Reached</p>
                            <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                                You have {activeNodeCount} active nodes (maximum {MAX_USER_NODES} allowed).
                                Please delete an existing node or wait for one to expire.
                                <Link href="/console/testnet-infra/nodes" className="ml-1 underline hover:no-underline">
                                    Manage your nodes →
                                </Link>
                            </p>
                        </div>
                    </div>
                )}

                {/* Node count indicator */}
                {!hasMaxNodes && activeNodeCount > 0 && (
                    <p className="text-sm text-gray-500 mb-4">
                        You have {activeNodeCount} of {MAX_USER_NODES} active nodes.
                    </p>
                )}

                <Button
                    onClick={handleCreate}
                    loading={isCreatingNode}
                    disabled={!canCreate}
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
