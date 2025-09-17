"use client";

import {
    RefreshCw,
    XCircle,
    Plus
} from "lucide-react";
import { Button } from "@/components/toolbox/components/Button";
import { NodeRegistration } from "@/components/toolbox/console/testnet-infra/ManagedTestnetNodes/types";
import NodeCard from "@/components/toolbox/console/testnet-infra/ManagedTestnetNodes/NodeCard";

interface NodesListProps {
    nodes: NodeRegistration[];
    isLoadingNodes: boolean;
    nodesError: string | null;
    onRefresh: () => void;
    onShowCreateForm: () => void;
    onDeleteNode: (node: NodeRegistration) => void;
    deletingNodes: Set<string>;
}

export default function NodesList({
    nodes,
    isLoadingNodes,
    nodesError,
    onRefresh,
    onShowCreateForm,
    onDeleteNode,
    deletingNodes
}: NodesListProps) {
    if (isLoadingNodes) {
        return (
            <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-8 h-8 mb-3">
                    <div className="w-5 h-5 animate-spin rounded-full border-2 border-solid border-gray-300 border-r-transparent"></div>
                </div>
                <h3 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-1">Loading Nodes</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Fetching your node registrations...</p>
            </div>
        );
    }

    if (nodes.length === 0) {
        return (
            <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-12 text-center">
                <h3 className="text-lg font-medium text-zinc-900 dark:text-white mb-2">
                    You don't have any hosted Nodes set up
                </h3>
                <Button
                    onClick={onShowCreateForm}
                    className="bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 !w-auto inline-flex"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Set Up your first hosted node
                </Button>
            </div>
        );
    }

    return (
        <>
            {/* Header with Refresh */}
            <div className="flex justify-between items-center mb-4">
                <button
                    onClick={onRefresh}
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
                {nodes.map((node) => (
                    <NodeCard
                        key={node.id}
                        node={node}
                        onDeleteNode={onDeleteNode}
                        isDeletingNode={deletingNodes.has(node.id)}
                    />
                ))}
            </div>
        </>
    );
}
