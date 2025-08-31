/**
 * REFACTORED VERSION - ManagedTestnetNodes component using the new hook
 * This demonstrates how much cleaner the component becomes with the extracted logic
 */

"use client";

import { useWalletStore } from "../../../stores/walletStore";
import { useState } from "react";
import { Container } from "../../../components/Container";
import { Button } from "../../../components/Button";
import { AddChainModal } from "../../../components/ConnectWallet/AddChainModal";
import { useL1ListStore } from "../../../stores/l1ListStore";
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter,
    AlertDialogHeader, 
    AlertDialogTitle 
} from "../../../components/AlertDialog";
import { 
    Plus,
    X,
} from "lucide-react";

import { useManagedTestnetNodes } from "./useManagedTestnetNodes";
import { NodeCreationResult } from "./api-types";
import CreateNodeForm from "./CreateNodeForm";
import SuccessMessage from "./SuccessMessage";
import NodesList from "./NodesList";

export default function ManagedTestnetNodesRefactored() {
    const { avalancheNetworkID, isTestnet } = useWalletStore();
    const { addL1 } = useL1ListStore()();

    // Use the new hook for all node management logic
    const nodeManager = useManagedTestnetNodes();

    // UI state only
    const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
    const [alertDialogTitle, setAlertDialogTitle] = useState("Error");
    const [alertDialogMessage, setAlertDialogMessage] = useState("");
    const [isLoginError, setIsLoginError] = useState(false);
    const [registrationResponse, setRegistrationResponse] = useState<NodeCreationResult | null>(null);
    const [connectWalletModalNodeId, setConnectWalletModalNodeId] = useState<string | null>(null);
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
        nodeManager.clearError();
    };

    const handleRegistration = (response: NodeCreationResult) => {
        setRegistrationResponse(response);
        setShowCreateForm(false);
        // No need to manually fetch nodes - the hook handles this automatically!
    };

    // Components now handle their own node operations via the hook

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
                {/* Stats Section - now using hook state directly */}
                <div className="mb-8 not-prose">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                <span className="font-semibold">{nodeManager.nodes.length}</span> / 3 active nodes
                            </p>
                        </div>
                        <Button 
                            onClick={() => setShowCreateForm(true)}
                            className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 !w-auto"
                            size="sm"
                            disabled={!nodeManager.canCreateNode}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add a node for a new L1
                        </Button>
                    </div>
                </div>

                {/* Create Node Form - now uses hook directly */}
                {showCreateForm && (
                    <CreateNodeForm
                        onClose={() => setShowCreateForm(false)}
                        onSuccess={handleRegistration}
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

                {/* Nodes List - now self-contained with hook */}
                <div className="not-prose">
                    <NodesList
                        onShowCreateForm={() => setShowCreateForm(true)}
                        onConnectWallet={setConnectWalletModalNodeId}
                        onDeleteError={handleError}
                        onDeleteSuccess={(message) => handleError("Node Deleted", message)}
                    />
                </div>
            </Container>

            {/* Connect Wallet Modal - using hook's getNodeById utility */}
            {connectWalletModalNodeId && (() => {
                const selectedNode = nodeManager.getNodeById(connectWalletModalNodeId);
                return selectedNode ? (
                    <AddChainModal
                        onClose={() => setConnectWalletModalNodeId(null)}
                        onAddChain={(chain) => {
                            addL1(chain);
                            setAlertDialogTitle("Wallet Connected!");
                            setAlertDialogMessage(`Successfully connected to ${chain.name}. The network has been added to your wallet.`);
                            setIsLoginError(false);
                            setIsAlertDialogOpen(true);
                            setConnectWalletModalNodeId(null);
                        }}
                        allowLookup={false}
                        fixedRPCUrl={selectedNode.rpc_url}
                    />
                ) : null;
            })()}
        </>
    );
}
