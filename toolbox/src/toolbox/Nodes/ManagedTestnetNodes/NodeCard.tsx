"use client";
import { useState } from "react";
import { 
    Copy, 
    Clock, 
    Wallet,
    Trash2,
    XCircle,
    CheckCircle2,
    AlertTriangle,
    Check,
} from "lucide-react";
import { NodeRegistration } from "./types";
import { calculateTimeRemaining, formatTimeRemaining, getStatusData } from "./useTimeRemaining";
import { Button } from "../../../components/Button";
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';

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
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const timeRemaining = calculateTimeRemaining(node.expires_at);
    const statusData = getStatusData(timeRemaining);
    const nodeInfoJson = JSON.stringify({
        jsonrpc: "2.0",
        result: {
            nodeID: node.node_id,
            nodePOP: {
                publicKey: node.public_key || "",
                proofOfPossession: node.proof_of_possession || ""
            }
        },
        id: 1
    }, null, 2);

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

    const handleLocalCopy = async (text: string, key: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedKey(key);
            window.setTimeout(() => setCopiedKey(null), 1500);
        } catch (err) {
            // Fallback to parent handler if clipboard fails
            try { onCopyToClipboard(text, key); } catch {}
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-colors min-w-0">
            {/* Node Header */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div>
                            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                                {node.chain_name || 'Unnamed Chain'} {node.node_index ? `Node ${node.node_index}` : ''}
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
                    </div>
                </div>
            </div>

            {/* Node Details (compact) */}
            <div className="p-4 space-y-2 min-w-0">
                <div className="grid grid-cols-1 gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="w-28 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Subnet ID</span>
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 min-w-0 flex-1">
                            <code className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate flex-1">{node.subnet_id}</code>
                            <button
                                onClick={() => handleLocalCopy(node.subnet_id, "subnetId")}
                                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                title={copiedKey === "subnetId" ? "Copied!" : "Copy Subnet ID"}
                            >
                                {copiedKey === "subnetId" ? (
                                    <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                                ) : (
                                    <Copy className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 min-w-0">
                        <span className="w-28 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Blockchain ID</span>
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 min-w-0 flex-1">
                            <code className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate flex-1">{node.blockchain_id}</code>
                            <button
                                onClick={() => handleLocalCopy(node.blockchain_id, "blockchainId")}
                                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                title={copiedKey === "blockchainId" ? "Copied!" : "Copy Blockchain ID"}
                            >
                                {copiedKey === "blockchainId" ? (
                                    <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                                ) : (
                                    <Copy className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                                )}
                            </button>
                        </div>
                    </div>

                    

                    <div className="flex items-center gap-2 min-w-0">
                        <span className="w-28 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">RPC URL</span>
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded border border-gray-200 dark:border-gray-600 min-w-0 flex-1">
                            <code className="text-xs font-mono text-gray-700 dark:text-gray-300 truncate flex-1">{node.rpc_url}</code>
                            <button
                                onClick={() => handleLocalCopy(node.rpc_url, "rpcUrl")}
                                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                                title={copiedKey === "rpcUrl" ? "Copied!" : "Copy RPC URL"}
                            >
                                {copiedKey === "rpcUrl" ? (
                                    <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                                ) : (
                                    <Copy className="w-3 h-3 text-gray-600 dark:text-gray-300" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* info.getNodeID API Response */}
                <div className="mt-2 w-full max-w-full">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">info.getNodeID API Response</p>
                    <div className="relative">
                        <button
                            onClick={() => handleLocalCopy(nodeInfoJson, "nodeInfoOverlay")}
                            className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-white/80 text-gray-700 border border-gray-200 shadow-sm hover:bg-white backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400 dark:bg-gray-700/80 dark:text-gray-100 dark:border-gray-600 dark:hover:bg-gray-700"
                            title={copiedKey === "nodeInfoOverlay" ? "Copied!" : "Copy"}
                        >
                            {copiedKey === "nodeInfoOverlay" ? (
                                <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                            ) : (
                                <Copy className="w-4 h-4" />
                            )}
                        </button>
                        <div className="overflow-x-auto">
                            <div className="inline-block min-w-full align-top">
                                <DynamicCodeBlock lang="json" code={nodeInfoJson} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Primary Actions */}
                <div className="mt-2 flex items-center justify-end gap-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                    <Button
                        onClick={() => handleLocalCopy(nodeInfoJson, "nodeInfo")}
                        variant="outline"
                        size="sm"
                        className="!w-auto"
                        icon={copiedKey === "nodeInfo" ? (
                            <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                        ) : (
                            <Copy className="w-4 h-4" />
                        )}
                    >
                        Copy Node Info
                    </Button>
                    <Button
                        onClick={() => onConnectWallet(node.id)}
                        variant="secondary"
                        size="sm"
                        stickLeft
                        icon={<Wallet className="w-4 h-4" />}
                    >
                        Add to Wallet
                    </Button>
                    <Button
                        onClick={() => onDeleteNode(node)}
                        variant="danger"
                        size="sm"
                        loading={isDeletingNode}
                        loadingText={node.node_index === null || node.node_index === undefined ? "Removing..." : "Deleting..."}
                        className="!w-auto"
                        icon={<Trash2 className="w-4 h-4" />}
                    >
                        {node.node_index === null || node.node_index === undefined ? 'Remove from Account' : 'Delete Node'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
