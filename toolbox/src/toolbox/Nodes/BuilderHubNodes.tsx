"use client";

import { useWalletStore } from "../../stores/walletStore";
import { useState, useEffect } from "react";
import { networkIDs } from "@avalabs/avalanchejs";
import { Container } from "../../components/Container";
import { getBlockchainInfo, getSubnetInfo } from "../../coreViem/utils/glacier";
import InputSubnetId from "../../components/InputSubnetId";
import BlockchainDetailsDisplay from "../../components/BlockchainDetailsDisplay";
import { Button } from "../../components/Button";
import { AddChainModal } from "../../components/ConnectWallet/AddChainModal";
import { useL1ListStore } from "../../stores/l1ListStore";
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter,
    AlertDialogHeader, 
    AlertDialogTitle 
} from "../../components/AlertDialog";
import { 
    RefreshCw, 
    Copy, 
    CheckCircle2, 
    Clock, 
    XCircle, 
    Server, 
    AlertTriangle,
    ChevronDown,
    ChevronUp,
    Plus,
    X,
    Wallet,
} from "lucide-react";

interface RegisterSubnetResponse {
    nodeID: string;
    nodePOP: {
        publicKey: string;
        proofOfPossession: string;
    };
}

interface NodeRegistration {
    id: string;
    subnet_id: string;
    blockchain_id: string;
    node_id: string;
    rpc_url: string;
    chain_name: string | null;
    created_at: string;
    expires_at: string;
    status: string;
    time_remaining: {
        days: number;
        hours: number;
        expired: boolean;
    };
}

interface NodeStatusResponse {
    jsonrpc: string;
    result?: {
        nodes: NodeRegistration[];
        total: number;
    };
    error?: {
        code: number;
        message: string;
    };
    id: number;
}

export default function BuilderHubNodes() {
    const { avalancheNetworkID, isTestnet } = useWalletStore();
    const { addL1 } = useL1ListStore()();

    // Remove tab state since we're combining everything into one view
    
    // Shared state
    const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
    const [alertDialogTitle, setAlertDialogTitle] = useState("Error");
    const [alertDialogMessage, setAlertDialogMessage] = useState("");
    const [isLoginError, setIsLoginError] = useState(false);

    // Create node state
    const [subnetId, setSubnetId] = useState("");
    const [subnet, setSubnet] = useState<any>(null);
    const [blockchainInfo, setBlockchainInfo] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [subnetIdError, setSubnetIdError] = useState<string | null>(null);
    const [isRegistering, setIsRegistering] = useState(false);
    const [registrationResponse, setRegistrationResponse] = useState<RegisterSubnetResponse | null>(null);
    const [_fullApiResponse, setFullApiResponse] = useState<any>(null);
    const [_chainAddedToWallet, setChainAddedToWallet] = useState<string | null>(null);
    const [selectedBlockchainId, setSelectedBlockchainId] = useState<string>("");

    // Manage nodes state
    const [nodes, setNodes] = useState<NodeRegistration[]>([]);
    const [isLoadingNodes, setIsLoadingNodes] = useState(true);
    const [nodesError, setNodesError] = useState<string | null>(null);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [apiResponses, setApiResponses] = useState<{[nodeId: string]: any}>({});
    const [loadingApiResponses, setLoadingApiResponses] = useState<Set<string>>(new Set());
    const [connectWalletModalNodeId, setConnectWalletModalNodeId] = useState<string | null>(null);

    // Show create form state
    const [showCreateForm, setShowCreateForm] = useState(false);

    const handleLogin = () => {
        window.location.href = "/login";
    };

    // Remove TabNavigation component since we don't need it anymore

    // Create node logic
    useEffect(() => {
        setSubnetIdError(null);
        setSubnet(null);
        setBlockchainInfo(null);
        setSelectedBlockchainId("");
        if (!subnetId) return;

        const abortController = new AbortController();
        setIsLoading(true);

        const loadSubnetData = async () => {
            try {
                const subnetInfo = await getSubnetInfo(subnetId, abortController.signal);
                if (abortController.signal.aborted) return;

                setSubnet(subnetInfo);

                if (subnetInfo.blockchains && subnetInfo.blockchains.length > 0) {
                    const blockchainId = subnetInfo.blockchains[0].blockchainId;
                    setSelectedBlockchainId(blockchainId);

                    try {
                        const chainInfo = await getBlockchainInfo(blockchainId, abortController.signal);
                        if (abortController.signal.aborted) return;
                        setBlockchainInfo(chainInfo);
                    } catch (error) {
                        if (!abortController.signal.aborted) {
                            setSubnetIdError((error as Error).message);
                        }
                    }
                }
            } catch (error) {
                if (!abortController.signal.aborted) {
                    setSubnetIdError((error as Error).message);
                }
            } finally {
                if (!abortController.signal.aborted) {
                    setIsLoading(false);
                }
            }
        };

        loadSubnetData();
        return () => abortController.abort();
    }, [subnetId]);

    const handleRegisterSubnet = async () => {
        if (!subnetId) {
            setAlertDialogTitle("Missing Information");
            setAlertDialogMessage("Please select a subnet ID first");
            setIsLoginError(false);
            setIsAlertDialogOpen(true);
            return;
        }

        setIsRegistering(true);
        setRegistrationResponse(null);

        try {
            const response = await fetch(`/api/builder-hub-node?subnetId=${subnetId}&blockchainId=${selectedBlockchainId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const rawText = await response.text();
            let data;
            
            try {
                data = JSON.parse(rawText);
            } catch (parseError) {
                throw new Error(`Invalid response: ${rawText.substring(0, 100)}...`);
            }

            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error(data.error?.message || "Rate limit exceeded. Please try again later.");
                }
                throw new Error(data.error?.message || `Error ${response.status}: Failed to register subnet`);
            }

            if (data.error) {
                throw new Error(data.error.message || 'Registration failed');
            }

            if (data.result) {
                console.log('Builder Hub registration successful:', data.result);
                setRegistrationResponse(data.result);
                setFullApiResponse(data);
                // Hide create form and refresh nodes
                setShowCreateForm(false);
                fetchNodes();
            } else {
                throw new Error('Unexpected response format');
            }
        } catch (error) {
            console.error("Builder Hub registration error:", error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            
            // Check for authentication errors
            if (errorMessage.includes('Authentication required') || errorMessage.includes('401')) {
                setAlertDialogTitle("Authentication Required");
                setAlertDialogMessage("Please sign in to create Builder Hub nodes. Use the login button above to authenticate.");
                setIsLoginError(true);
            } else {
                setAlertDialogTitle("Registration Failed");
                setAlertDialogMessage(errorMessage);
                setIsLoginError(false);
            }
            setIsAlertDialogOpen(true);
        } finally {
            setIsRegistering(false);
        }
    };

    const handleReset = () => {
        setSubnetId("");
        setSubnet(null);
        setBlockchainInfo(null);
        setSubnetIdError(null);
        setIsRegistering(false);
        setRegistrationResponse(null);
        setFullApiResponse(null);
        setChainAddedToWallet(null);
        setSelectedBlockchainId("");
        setIsAlertDialogOpen(false);
        setAlertDialogTitle("Error");
        setAlertDialogMessage("");
        setIsLoginError(false);
        setShowCreateForm(false);
    };

    // Manage nodes logic
    const fetchNodes = async () => {
        setIsLoadingNodes(true);
        setNodesError(null);

        try {
            const response = await fetch('/api/node-registrations', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const data: NodeStatusResponse = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.error?.message || 'Failed to fetch nodes');
            }

            if (data.result) {
                setNodes(data.result.nodes);
            }
        } catch (error) {
            console.error("Failed to fetch nodes:", error);
            setNodesError(error instanceof Error ? error.message : 'Failed to fetch nodes');
        } finally {
            setIsLoadingNodes(false);
        }
    };

    const toggleNodeExpanded = async (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        if (expandedNodes.has(nodeId)) {
            setExpandedNodes(prev => {
                const newSet = new Set(prev);
                newSet.delete(nodeId);
                return newSet;
            });
        } else {
            setExpandedNodes(prev => {
                const newSet = new Set(prev);
                newSet.add(nodeId);
                return newSet;
            });

            if (!apiResponses[nodeId]) {
                setLoadingApiResponses(prev => new Set(prev).add(nodeId));
                
                try {
                    const response = await fetch('/api/builder-hub-node', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ subnetId: node.subnet_id })
                    });

                    const data = await response.json();
                    
                    setApiResponses(prev => ({
                        ...prev,
                        [nodeId]: data
                    }));
                } catch (error) {
                    console.error('Failed to fetch API response:', error);
                    setApiResponses(prev => ({
                        ...prev,
                        [nodeId]: { error: 'Failed to fetch API response' }
                    }));
                } finally {
                    setLoadingApiResponses(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(nodeId);
                        return newSet;
                    });
                }
            }
        }
    };

    const copyToClipboard = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setAlertDialogTitle("Copied!");
            setAlertDialogMessage(`${label} has been copied to your clipboard.`);
            setIsAlertDialogOpen(true);
        } catch (error) {
            setAlertDialogTitle("Copy Failed");
            setAlertDialogMessage("Failed to copy to clipboard. Please copy manually.");
            setIsAlertDialogOpen(true);
        }
    };

    const formatTimeRemaining = (timeRemaining: NodeRegistration['time_remaining']) => {
        if (timeRemaining.expired) {
            return "Expired";
        }
        
        // Ensure hours don't exceed 24 when days are present
        const normalizedHours = timeRemaining.days > 0 ? timeRemaining.hours % 24 : timeRemaining.hours;
        
        if (timeRemaining.days > 0) {
            return `${timeRemaining.days}d ${normalizedHours}h`;
        } else {
            return `${timeRemaining.hours}h`;
        }
    };

    const getStatusData = (timeRemaining: NodeRegistration['time_remaining']) => {
        if (timeRemaining.expired) {
            return {
                color: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
                icon: <XCircle className="w-3 h-3" />,
                label: "Expired"
            };
        } else if (timeRemaining.days <= 1) {
            return {
                color: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
                icon: <AlertTriangle className="w-3 h-3" />,
                label: "Expiring Soon"
            };
        } else {
            return {
                color: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700",
                icon: <CheckCircle2 className="w-3 h-3" />,
                label: "Active"
            };
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
                            <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-1">
                                Layer 1 Nodes
                            </h2>
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">
                                {nodes.length} / 3 active nodes
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
                    <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6 not-prose">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold">Create New Node</h3>
                            <Button
                                onClick={() => setShowCreateForm(false)}
                                variant="outline"
                                size="sm"
                                className="!w-auto"
                            >
                                Cancel
                            </Button>
                        </div>
                        <p className="mb-4">Enter the Subnet ID of the blockchain you want to create a node for.</p>

                        <InputSubnetId
                            value={subnetId}
                            onChange={setSubnetId}
                            error={subnetIdError}
                        />

                        {subnet && subnet.blockchains && subnet.blockchains.length > 0 && (
                            <div className="space-y-4 mt-4">
                                {subnet.blockchains.map((blockchain: { blockchainId: string; blockchainName: string; createBlockTimestamp: number; createBlockNumber: string; vmId: string; subnetId: string; evmChainId: number }) => (
                                    <BlockchainDetailsDisplay
                                        key={blockchain.blockchainId}
                                        blockchain={{
                                            ...blockchain,
                                            isTestnet: avalancheNetworkID === networkIDs.FujiID
                                        }}
                                        isLoading={isLoading}
                                        customTitle={`${blockchain.blockchainName} Blockchain Details`}
                                    />
                                ))}
                            </div>
                        )}

                        {subnetId && blockchainInfo && (
                            <Button 
                                onClick={handleRegisterSubnet}
                                loading={isRegistering}
                                className="mt-4 !w-auto"
                            >
                                Create Node
                            </Button>
                        )}
                    </div>
                )}

                {/* Success Message */}
                {registrationResponse && (
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 p-6 mb-6 not-prose">
                        <div className="flex items-center mb-4">
                            <div className="flex-shrink-0">
                                <svg className="h-8 w-8 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
                                    Node Created Successfully!
                                </h3>
                                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                                    Your subnet has been registered with Builder Hub and your node is now running.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <Button 
                                onClick={handleReset}
                                variant="outline"
                                size="sm"
                                className="text-green-700 border-green-300 hover:bg-green-100 dark:text-green-300 dark:border-green-600 dark:hover:bg-green-800 !w-auto"
                            >
                                Create Another Node
                            </Button>
                            <Button 
                                onClick={() => setRegistrationResponse(null)}
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white !w-auto"
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                )}

                {/* Empty State or Nodes List */}
                <div className="not-prose">
                    {isLoadingNodes ? (
                        <div className="text-center py-12">
                            <div className="inline-flex items-center justify-center w-8 h-8 mb-3">
                                <div className="w-5 h-5 animate-spin rounded-full border-2 border-solid border-gray-300 border-r-transparent"></div>
                            </div>
                            <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-1">Loading Nodes</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Fetching your node registrations...</p>
                        </div>
                    ) : nodes.length === 0 ? (
                        <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-12 text-center">
                            <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
                                You don't have any hosted Nodes set up
                            </h3>
                            <Button 
                                onClick={() => setShowCreateForm(true)}
                                className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 !w-auto inline-flex"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Set Up your first hosted node
                            </Button>
                        </div>
                    ) : (
                        <>
                            {/* Header with Refresh */}
                            <div className="flex justify-between items-center mb-4">
                                <button
                                    onClick={fetchNodes}
                                    disabled={isLoadingNodes}
                                    className="p-1.5 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300"
                                    title="Refresh nodes"
                                >
                                    <RefreshCw className={`w-3 h-3 ${isLoadingNodes ? 'animate-spin' : ''}`} />
                                    Refresh
                                </button>
                            </div>

                            {nodesError && (
                                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 flex items-start gap-2">
                                    <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error Loading Nodes</h3>
                                        <p className="text-sm text-red-700 dark:text-red-300">{nodesError}</p>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                {nodes.map((node) => {
                                    const statusData = getStatusData(node.time_remaining);
                                    
                                    return (
                                        <div key={node.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                                            {/* Node Header */}
                                            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                                                            <Server className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                                                                {node.chain_name || 'Unnamed Chain'}
                                                            </h3>
                                                            <div className="flex items-center gap-3">
                                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${statusData.color}`}>
                                                                    {statusData.icon}
                                                                    {statusData.label}
                                                                </span>
                                                                <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                                                    <Clock className="w-3 h-3" />
                                                                    {formatTimeRemaining(node.time_remaining)} remaining
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="text-right text-xs text-gray-500 dark:text-gray-400 space-y-1">
                                                        <div>
                                                            Created: {new Date(node.created_at).toLocaleDateString('en-US', { 
                                                                month: 'short', 
                                                                day: 'numeric',
                                                                year: 'numeric'
                                                            })}
                                                        </div>
                                                        <div>
                                                            Expires: {new Date(node.expires_at).toLocaleDateString('en-US', { 
                                                                month: 'short', 
                                                                day: 'numeric',
                                                                year: 'numeric'
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Node Details */}
                                            <div className="p-4">
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                    {/* Left Column */}
                                                    <div className="space-y-3">
                                                        <div>
                                                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">
                                                                Subnet ID
                                                            </label>
                                                            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600">
                                                                <code className="text-xs font-mono text-gray-700 dark:text-gray-300 flex-1 truncate">
                                                                    {node.subnet_id}
                                                                </code>
                                                                <button
                                                                    onClick={() => copyToClipboard(node.subnet_id, "Subnet ID")}
                                                                    className="p-1 rounded bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                                                                    title="Copy Subnet ID"
                                                                >
                                                                    <Copy className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">
                                                                Node ID
                                                            </label>
                                                            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600">
                                                                <code className="text-xs font-mono text-gray-700 dark:text-gray-300 flex-1 truncate">
                                                                    {node.node_id}
                                                                </code>
                                                                <button
                                                                    onClick={() => copyToClipboard(node.node_id, "Node ID")}
                                                                    className="p-1 rounded bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                                                                    title="Copy Node ID"
                                                                >
                                                                    <Copy className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Right Column */}
                                                    <div className="space-y-3">
                                                        <div>
                                                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">
                                                                Blockchain ID
                                                            </label>
                                                            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600">
                                                                <code className="text-xs font-mono text-gray-700 dark:text-gray-300 flex-1 truncate">
                                                                    {node.blockchain_id}
                                                                </code>
                                                                <button
                                                                    onClick={() => copyToClipboard(node.blockchain_id, "Blockchain ID")}
                                                                    className="p-1 rounded bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                                                                    title="Copy Blockchain ID"
                                                                >
                                                                    <Copy className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">
                                                                RPC URL
                                                            </label>
                                                            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600">
                                                                <code className="text-xs font-mono text-gray-700 dark:text-gray-300 flex-1 truncate">
                                                                    {node.rpc_url}
                                                                </code>
                                                                <button
                                                                    onClick={() => setConnectWalletModalNodeId(node.id)}
                                                                    className="p-1 rounded bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800/30 transition-colors"
                                                                    title="Connect Wallet to RPC"
                                                                >
                                                                    <Wallet className="w-3 h-3 text-blue-600 dark:text-blue-300" />
                                                                </button>
                                                                <button
                                                                    onClick={() => copyToClipboard(node.rpc_url, "RPC URL")}
                                                                    className="p-1 rounded bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                                                                    title="Copy RPC URL"
                                                                >
                                                                    <Copy className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Node JSON Dropdown */}
                                                <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                                                    <button
                                                        onClick={() => toggleNodeExpanded(node.id)}
                                                        className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                                                    >
                                                        {expandedNodes.has(node.id) ? (
                                                            <ChevronUp className="w-4 h-4" />
                                                        ) : (
                                                            <ChevronDown className="w-4 h-4" />
                                                        )}
                                                        View Node Info
                                                    </button>
                                                    
                                                    {expandedNodes.has(node.id) && (
                                                        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">info.getNodeID Response:</p>
                                                                {apiResponses[node.id] && !loadingApiResponses.has(node.id) && (
                                                                    <button
                                                                        onClick={() => copyToClipboard(JSON.stringify(apiResponses[node.id], null, 2), "API Response")}
                                                                        className="p-1 rounded bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                                                                        title="Copy API Response"
                                                                    >
                                                                        <Copy className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                            {loadingApiResponses.has(node.id) ? (
                                                                <div className="flex items-center justify-center py-4">
                                                                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-solid border-gray-300 border-r-transparent"></div>
                                                                    <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading API response...</span>
                                                                </div>
                                                            ) : (
                                                                <pre className="text-xs bg-white dark:bg-gray-900 px-3 py-2 rounded border font-mono text-gray-600 dark:text-gray-400 overflow-auto max-h-64">
                                                                    {JSON.stringify(apiResponses[node.id] || { error: 'No data available' }, null, 2)}
                                                                </pre>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </Container>

            {/* Connect Wallet Modal */}
            {connectWalletModalNodeId && (() => {
                const selectedNode = nodes.find(n => n.id === connectWalletModalNodeId);
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