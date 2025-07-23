"use client";

import { useState, useEffect } from "react";
import { Container } from "../../components/Container";
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
    ChevronUp
} from "lucide-react";

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

export default function NodeStatus() {
    const [nodes, setNodes] = useState<NodeRegistration[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAlertDialogOpen, setIsAlertDialogOpen] = useState(false);
    const [alertDialogTitle, setAlertDialogTitle] = useState("Error");
    const [alertDialogMessage, setAlertDialogMessage] = useState("");
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [apiResponses, setApiResponses] = useState<{[nodeId: string]: any}>({});
    const [loadingApiResponses, setLoadingApiResponses] = useState<Set<string>>(new Set());

    const toggleNodeExpanded = async (nodeId: string) => {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        if (expandedNodes.has(nodeId)) {
            // Just collapse
            setExpandedNodes(prev => {
                const newSet = new Set(prev);
                newSet.delete(nodeId);
                return newSet;
            });
        } else {
            // Expand and fetch API response if we don't have it
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

    const fetchNodes = async () => {
        setIsLoading(true);
        setError(null);

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
            setError(error instanceof Error ? error.message : 'Failed to fetch nodes');
        } finally {
            setIsLoading(false);
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
        
        if (timeRemaining.days > 0) {
            return `${timeRemaining.days}d ${timeRemaining.hours}h`;
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
                color: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
                icon: <CheckCircle2 className="w-3 h-3" />,
                label: "Active"
            };
        }
    };

    useEffect(() => {
        fetchNodes();
    }, []);

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
                    <AlertDialogFooter>
                        <AlertDialogAction>OK</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <div className="max-w-6xl mx-auto">
                <Container
                    title="Builder Hub Nodes"
                    description="Manage your active Builder Hub nodes with real-time monitoring and easy access to RPC endpoints."
                >
                    {/* Header with Refresh */}
                    <div className="flex justify-between items-center mb-4">
                        <button
                            onClick={fetchNodes}
                            disabled={isLoading}
                            className="p-1.5 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300"
                            title="Refresh nodes"
                        >
                            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 flex items-start gap-2">
                            <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                            <div>
                                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error Loading Nodes</h3>
                                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                            </div>
                        </div>
                    )}

                    {isLoading ? (
                        <div className="text-center py-12">
                            <div className="inline-flex items-center justify-center w-8 h-8 mb-3">
                                <div className="w-5 h-5 animate-spin rounded-full border-2 border-solid border-gray-300 border-r-transparent"></div>
                            </div>
                            <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-1">Loading Nodes</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Fetching your node registrations...</p>
                        </div>
                    ) : nodes.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg mb-4">
                                <Server className="w-6 h-6 text-gray-400" />
                            </div>
                            <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-2">No Nodes Found</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">
                                You haven't registered any nodes yet. Create your first node registration to get started.
                            </p>
                            <button className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-md transition-colors font-medium">
                                Register New Node
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {nodes.map((node) => {
                                const statusData = getStatusData(node.time_remaining);
                                
                                return (
                                    <div key={node.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                                        {/* Node Header */}
                                        <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-start gap-3">
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
                    )}
                </Container>
            </div>
        </>
    );
} 