"use client";

import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useState, useEffect } from "react";
import { Button } from "@/components/toolbox/components/Button";
import {
    Plus,
} from "lucide-react";

import {
    NodeRegistration,
    RegisterSubnetResponse
} from "./types";
import CreateNodeForm from "./CreateNodeForm";
import NodesList from "./NodesList";
import useConsoleNotifications from "@/hooks/useConsoleNotifications";
import { useManagedTestnetNodes } from "@/hooks/useManagedTestnetNodes";
import { toast } from "@/hooks/use-toast";
import TestnetOnly from "./TestnetOnly";
import { ConsoleToolMetadata, withConsoleToolMetadata } from "../../../components/WithConsoleToolMetadata";
import { generateConsoleToolGitHubUrl } from "@/components/toolbox/utils/github-url";

const metadata: ConsoleToolMetadata = {
    title: "Managed Testnet Nodes",
    description: "Manage your hosted testnet nodes.",
    walletRequirements: [],
    githubUrl: generateConsoleToolGitHubUrl(import.meta.url)
};

function ManagedTestnetNodesBase() {
    // Load nodes when component mounts
      useEffect(() => {
        fetchNodes();
    }, []);
    
    const { avalancheNetworkID, isTestnet } = useWalletStore();
    const {
        nodes,
        isLoadingNodes,
        nodesError,
        deletingNodes,
        fetchNodes,
        createNode,
        deleteNode
    } = useManagedTestnetNodes();
    const { notify } = useConsoleNotifications();

    // Create node state
    const [isRegistering, setIsRegistering] = useState(false);

    // Show create form state
    const [showCreateForm, setShowCreateForm] = useState(false);

    const handleRegistration = async (subnetId: string, blockchainId: string) => {
        setIsRegistering(true);
        try {
            const createPromise = createNode(subnetId, blockchainId);
            notify({ name: "Managed Testnet Node Creation", type: "local" }, createPromise);
            setShowCreateForm(false);
            fetchNodes();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            if (errorMessage.includes('Authentication required') || errorMessage.includes('401')) {
                toast({
                    title: "Authentication Required",
                    description: "Please sign in to create nodes.",
                    variant: "destructive",
                });
            } else {
                toast({
                    title: "Registration Failed",
                    description: errorMessage,
                    variant: "destructive",
                });
            }
        } finally {
            setIsRegistering(false);
        }
    };

    const handleDeleteNode = async (node: NodeRegistration) => {
        try {
            const deletePromise = deleteNode(node);
            notify({ name: "Managed Testnet Node Deletion", type: "local" }, deletePromise);
            await deletePromise;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to delete node';
            if (errorMessage.includes('Authentication required') || errorMessage.includes('401')) {
                toast({
                    title: "Authentication Required",
                    description: "Please sign in to delete nodes.",
                    variant: "destructive",
                });
            } else {
                toast({
                    title: "Delete Failed",
                    description: errorMessage,
                    variant: "destructive",
                });
            }
        }
    };
    // If not on testnet, show disabled message
    if (!isTestnet) {
        return (
            <TestnetOnly />
        );
    }

    return (
        <>
            {/* Stats Section */}
            <div className="mb-8 not-prose">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                            <span className="font-semibold">{nodes.length}</span> / 3 active nodes
                        </p>
                    </div>
                    <Button
                        onClick={() => setShowCreateForm(true)}
                        className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 !w-auto"
                        size="sm"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add a node for a new L1
                    </Button>
                </div>
            </div>

            {/* Create Node Form */}
            {showCreateForm && (
                <CreateNodeForm
                    onClose={() => setShowCreateForm(false)}
                    onSubmit={handleRegistration}
                    onError={(title, message) => toast({ title, description: message, variant: "destructive" })}
                    avalancheNetworkID={avalancheNetworkID}
                    isRegistering={isRegistering}
                />
            )}

            {/* Nodes List */}
            <div className="not-prose">
                <NodesList
                    nodes={nodes}
                    isLoadingNodes={isLoadingNodes}
                    nodesError={nodesError}
                    onRefresh={fetchNodes}
                    onShowCreateForm={() => setShowCreateForm(true)}
                    onDeleteNode={handleDeleteNode}
                    deletingNodes={deletingNodes}
                />
            </div>
        </>
    );
}

export default withConsoleToolMetadata(ManagedTestnetNodesBase, metadata);