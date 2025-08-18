"use client";

import { useState } from "react";
import { 
    Copy, 
    Clock, 
    Server, 
    ChevronDown,
    ChevronUp,
    Wallet,
    Trash2,
    XCircle,
    CheckCircle2,
    AlertTriangle,
} from "lucide-react";
import { NodeRegistration } from "./types";
import { calculateTimeRemaining, formatTimeRemaining, getStatusData } from "./useTimeRemaining";

interface NodeCardProps {
    node: NodeRegistration;
    onConnectWallet: (nodeId: string) => void;
    onDeleteNode: (node: NodeRegistration) => void;
    onCopyToClipboard: (text: string, label: string) => void;
    isDeletingNode: boolean;
}

export default function NodeCard({ 
    node, 
    onConnectWallet, 
    onDeleteNode, 
    onCopyToClipboard, 
    isDeletingNode 
}: NodeCardProps) {
    const [expanded, setExpanded] = useState(false);
    const [apiResponse, setApiResponse] = useState<any>(null);
    const [loadingApiResponse, setLoadingApiResponse] = useState(false);

    const timeRemaining = calculateTimeRemaining(node.expires_at);
    const statusData = getStatusData(timeRemaining);

    const getStatusIcon = (iconType: 'expired' | 'warning' | 'active') => {
        switch (iconType) {
            case 'expired':
                return <XCircle className="w-3 h-3" />;
            case 'warning':
                return <AlertTriangle className="w-3 h-3" />;
            case 'active':
                return <CheckCircle2 className="w-3 h-3" />;
            default:
                return <XCircle className="w-3 h-3" />;
        }
    };

    const toggleExpanded = async () => {
        if (expanded) {
            setExpanded(false);
        } else {
            setExpanded(true);

            if (!apiResponse) {
                setLoadingApiResponse(true);
                
                try {
                    const response = await fetch('/api/builder-hub-node', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ 
                            action: 'status',
                            subnetId: node.subnet_id 
                        })
                    });

                    const data = await response.json();
                    setApiResponse(data);
                } catch (error) {
                    console.error('Failed to fetch API response:', error);
                    setApiResponse({ error: 'Failed to fetch API response' });
                } finally {
                    setLoadingApiResponse(false);
                }
            }
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
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
                                    {getStatusIcon(statusData.iconType)}
                                    {statusData.label}
                                </span>
                                <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatTimeRemaining(timeRemaining)} remaining
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
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
                        {node.node_index !== null && node.node_index !== undefined && (
                            <button
                                onClick={() => onDeleteNode(node)}
                                disabled={isDeletingNode}
                                className="p-1.5 rounded-md bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-800/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Delete node"
                            >
                                {isDeletingNode ? (
                                    <div className="w-3 h-3 animate-spin rounded-full border border-solid border-red-600 border-r-transparent"></div>
                                ) : (
                                    <Trash2 className="w-3 h-3 text-red-600 dark:text-red-400" />
                                )}
                            </button>
                        )}
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
                                    onClick={() => onCopyToClipboard(node.subnet_id, "Subnet ID")}
                                    className="p-1 rounded bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                                    title="Copy Subnet ID"
                                >
                                    <Copy className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1 block">
                                Node ID {node.node_index !== null && node.node_index !== undefined && `(Index: ${node.node_index})`}
                            </label>
                            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600">
                                <code className="text-xs font-mono text-gray-700 dark:text-gray-300 flex-1 truncate">
                                    {node.node_id}
                                </code>
                                <button
                                    onClick={() => onCopyToClipboard(node.node_id, "Node ID")}
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
                                    onClick={() => onCopyToClipboard(node.blockchain_id, "Blockchain ID")}
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
                                    onClick={() => onConnectWallet(node.id)}
                                    className="p-1 rounded bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800/30 transition-colors"
                                    title="Connect Wallet to RPC"
                                >
                                    <Wallet className="w-3 h-3 text-blue-600 dark:text-blue-300" />
                                </button>
                                <button
                                    onClick={() => onCopyToClipboard(node.rpc_url, "RPC URL")}
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
                        onClick={toggleExpanded}
                        className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                    >
                        {expanded ? (
                            <ChevronUp className="w-4 h-4" />
                        ) : (
                            <ChevronDown className="w-4 h-4" />
                        )}
                        View Node Info
                    </button>
                    
                    {expanded && (
                        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Subnet Status:</p>
                                {apiResponse && !loadingApiResponse && (
                                    <button
                                        onClick={() => onCopyToClipboard(JSON.stringify(apiResponse, null, 2), "Subnet Status")}
                                        className="p-1 rounded bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                                        title="Copy Subnet Status"
                                    >
                                        <Copy className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                                    </button>
                                )}
                            </div>
                            {loadingApiResponse ? (
                                <div className="flex items-center justify-center py-4">
                                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-solid border-gray-300 border-r-transparent"></div>
                                    <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading subnet status...</span>
                                </div>
                            ) : (
                                (() => {
                                    const status = apiResponse;
                                    if (status?.error) {
                                        return (
                                            <div className="text-sm text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900/20 rounded">
                                                Error: {status.error}
                                            </div>
                                        );
                                    }
                                    
                                    if (status?.nodes && Array.isArray(status.nodes)) {
                                        return (
                                            <div className="space-y-2">
                                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                                    Total nodes: {status.nodes.length}
                                                </div>
                                                {status.nodes.map((nodeData: any, index: number) => (
                                                    <div key={index} className="p-2 bg-white dark:bg-gray-900 rounded border text-xs space-y-2">
                                                        <div className="font-medium">Node #{nodeData.nodeIndex}</div>
                                                        <div className="text-gray-500 dark:text-gray-500">
                                                            Created: {nodeData.dateCreated ? new Date(nodeData.dateCreated).toLocaleString() : 'N/A'}
                                                        </div>
                                                        {nodeData.nodeInfo && (
                                                            <div className="mt-2">
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <span className="font-medium text-gray-700 dark:text-gray-300">Node Info:</span>
                                                                    <button
                                                                        onClick={() => onCopyToClipboard(JSON.stringify(nodeData.nodeInfo, null, 2), "Node Info")}
                                                                        className="p-1 rounded bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                                                                        title="Copy Node Info"
                                                                    >
                                                                        <Copy className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                                                                    </button>
                                                                </div>
                                                                <pre className="text-xs bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded border font-mono text-gray-600 dark:text-gray-400 overflow-auto max-h-48">
                                                                    {JSON.stringify(nodeData.nodeInfo, null, 2)}
                                                                </pre>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    }
                                    
                                    return (
                                        <pre className="text-xs bg-white dark:bg-gray-900 px-3 py-2 rounded border font-mono text-gray-600 dark:text-gray-400 overflow-auto max-h-64">
                                            {JSON.stringify(status || { error: 'No data available' }, null, 2)}
                                        </pre>
                                    );
                                })()
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
