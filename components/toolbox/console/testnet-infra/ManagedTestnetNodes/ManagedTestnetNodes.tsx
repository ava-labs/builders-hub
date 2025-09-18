"use client";

import { useWalletStore } from "@/components/toolbox/stores/walletStore";
import { useState, useEffect } from "react";
import { Container } from "@/components/toolbox/components/Container";
import { Button } from "@/components/toolbox/components/Button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle
} from "@/components/toolbox/components/AlertDialog";
import {
    Plus,
    X,
} from "lucide-react";

import {
    NodeRegistration,
    RegisterSubnetResponse
} from "./types";
import CreateNodeForm from "./CreateNodeForm";
import SuccessMessage from "./SuccessMessage";
import NodesList from "./NodesList";

export default function ManagedTestnetNodes() {
    const { avalancheNetworkID, isTestnet } = useWalletStore();

    // Shared state
    const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
    const [alertDialogTitle, setAlertDialogTitle] = useState("Error");
    const [alertDialogMessage, setAlertDialogMessage] = useState("");
    const [isLoginError, setIsLoginError] = useState(false);

    // Create node state
    const [registrationResponse, setRegistrationResponse] = useState<RegisterSubnetResponse | null>(null);

    // Manage nodes state
    const [nodes, setNodes] = useState<NodeRegistration[]>([]);
    const [isLoadingNodes, setIsLoadingNodes] = useState(true);
    const [nodesError, setNodesError] = useState<string | null>(null);
    const [deletingNodes, setDeletingNodes] = useState<Set<string>>(new Set());

    // Show create form state
    const [showCreateForm, setShowCreateForm] = useState(false);

    const handleLogin = () => {
        window.location.href = "/login";
    };

    const handleError = (title: string, message: string, isLoginError: boolean = false) => {
        setAlertDialogTitle(title);
        setAlertDialogMessage(message);
        setIsLoginError(isLoginError);
        setIsAlertDialogOpen(true);
    };

    const handleReset = () => {
        setRegistrationResponse(null);
        setIsAlertDialogOpen(false);
        setAlertDialogTitle("Error");
        setAlertDialogMessage("");
        setIsLoginError(false);
        setShowCreateForm(false);
    };

    const handleRegistration = (response: RegisterSubnetResponse) => {
        setRegistrationResponse(response);
        setShowCreateForm(false);
        fetchNodes();
    };

    // Manage nodes logic
    const fetchNodes = async () => {
        setIsLoadingNodes(true);
        setNodesError(null);

        try {
            const response = await fetch('/api/managed-testnet-nodes', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.message || data.error || 'Failed to fetch nodes');
            }

            if (data.nodes) {
                setNodes(data.nodes);
            }
        } catch (error) {
            console.error("Failed to fetch nodes:", error);
            setNodesError(error instanceof Error ? error.message : 'Failed to fetch nodes');
        } finally {
            setIsLoadingNodes(false);
        }
    };

    const handleDeleteNode = async (node: NodeRegistration) => {
        // If node_index is missing, allow account-only removal
        if (node.node_index === null || node.node_index === undefined) {
            try {
                const response = await fetch(`/api/managed-testnet-nodes?id=${encodeURIComponent(node.id)}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' }
                });
                const data = await response.json();
                if (!response.ok || data.error) {
                    throw new Error(data.message || data.error || 'Failed to remove node from account');
                }
                setAlertDialogTitle("Removed from Account");
                setAlertDialogMessage(data.message || "This node has been removed from your account.");
                setIsLoginError(false);
                setIsAlertDialogOpen(true);
                fetchNodes();
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Failed to remove node from account';
                setAlertDialogTitle("Remove Failed");
                setAlertDialogMessage(errorMessage);
                setIsLoginError(false);
                setIsAlertDialogOpen(true);
            }
            return;
        }

        setDeletingNodes(prev => new Set(prev).add(node.id));

        try {
            const response = await fetch(`/api/managed-testnet-nodes/${node.subnet_id}/${node.node_index}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.message || data.error || 'Failed to delete node');
            }

            setAlertDialogTitle("Node Deleted");
            setAlertDialogMessage(data.message || "The node has been successfully removed from the subnet.");
            setIsLoginError(false);
            setIsAlertDialogOpen(true);

            // Refresh the nodes list
            fetchNodes();
        } catch (error) {
            console.error('Failed to delete node:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to delete node';

            // Check for authentication errors
            if (errorMessage.includes('Authentication required') || errorMessage.includes('401')) {
                setAlertDialogTitle("Authentication Required");
                setAlertDialogMessage("Please sign in to delete nodes. Use the login button above to authenticate.");
                setIsLoginError(true);
            } else {
                setAlertDialogTitle("Delete Failed");
                setAlertDialogMessage(errorMessage);
                setIsLoginError(false);
            }
            setIsAlertDialogOpen(true);
        } finally {
            setDeletingNodes(prev => {
                const newSet = new Set(prev);
                newSet.delete(node.id);
                return newSet;
            });
        }
    };


    // Load nodes when component mounts
    useEffect(() => {
        fetchNodes();
    }, []);

    // If not on testnet, show disabled message
    if (!isTestnet) {
        return (
            <Container
                title="Hosted L1 Testnet Nodes"
                description="We recommend using cloud-hosted Avalanche nodes with open ports for testing, as running a node locally can be challenging and may introduce security risks when configuring the required ports. To simplify the process, the Avalanche Builder Hub provides free access to hosted testnet nodes, allowing developers to quickly experiment without managing their own infrastructure. This service is completely free to use, but you'll need to create an Avalanche Builder Account to get started."
            >
                <div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700 rounded-2xl p-8 text-center">
                    <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <X className="w-8 h-8 text-red-600 dark:text-red-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-zinc-900 dark:text-white mb-4">
                        Testnet Only Feature
                    </h2>
                    <p className="text-zinc-600 dark:text-zinc-400 mb-6">
                        Builder Hub Nodes are only available on testnet. Switch to Fuji testnet to create and manage nodes for your L1s.
                    </p>
                </div>
            </Container>
        );
    }

    return (
        <>
            <AlertDialog open={isAlertDialogOpen} onOpenChange={setIsAlertDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{alertDialogTitle}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {alertDialogMessage}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex gap-2">
                        {isLoginError ? (
                            <>
                                <AlertDialogAction onClick={handleLogin} className="bg-blue-500 hover:bg-blue-600">
                                    Login
                                </AlertDialogAction>
                                <AlertDialogAction className="bg-zinc-200 hover:bg-zinc-300 text-zinc-800">
                                    Close
                                </AlertDialogAction>
                            </>
                        ) : (
                            <AlertDialogAction>OK</AlertDialogAction>
                        )}
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Container
                title="Hosted L1 Testnet Nodes"
                description="Free cloud-hosted Avalanche nodes for testing. Create an Avalanche Builder Account to get started."
            >
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
                        onRegister={handleRegistration}
                        onError={handleError}
                        avalancheNetworkID={avalancheNetworkID}
                    />
                )}

                {/* Success Message */}
                {registrationResponse && (
                    <SuccessMessage
                        onReset={handleReset}
                        onClose={() => setRegistrationResponse(null)}
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
            </Container>

        </>
    );
}
