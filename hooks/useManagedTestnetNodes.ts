"use client";

import { useState, useCallback } from "react";
import { NodeRegistration, RegisterSubnetResponse } from "@/components/toolbox/console/testnet-infra/ManagedTestnetNodes/types";

export function useManagedTestnetNodes() {
    const [nodes, setNodes] = useState<NodeRegistration[]>([]);
    const [isLoadingNodes, setIsLoadingNodes] = useState(true);
    const [nodesError, setNodesError] = useState<string | null>(null);
    const [deletingNodes, setDeletingNodes] = useState<Set<string>>(new Set());

    const fetchNodes = useCallback(async () => {
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
    }, []);

    const createNode = useCallback(async (subnetId: string, blockchainId: string) => {
        try {
            const response = await fetch('/api/managed-testnet-nodes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    subnetId,
                    blockchainId
                })
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error(data.message || data.error || "Rate limit exceeded. Please try again later.");
                }
                throw new Error(data.message || data.error || `Error ${response.status}: Failed to register subnet`);
            }

            if (data.error) {
                throw new Error(data.message || data.error || 'Registration failed');
            }

            if (data.builder_hub_response) {
                return data.builder_hub_response as RegisterSubnetResponse;
            } else {
                throw new Error('Unexpected response format');
            }
        } catch (error) {
            throw error;
        }
    }, []);

    const deleteNode = useCallback(async (node: NodeRegistration) => {
        setDeletingNodes(prev => new Set(prev).add(node.id));

        try {
            let response;
            if (node.node_index === null || node.node_index === undefined) {
                response = await fetch(`/api/managed-testnet-nodes?id=${encodeURIComponent(node.id)}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' }
                });
            } else {
                response = await fetch(`/api/managed-testnet-nodes/${node.subnet_id}/${node.node_index}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                    }
                });
            }

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.message || data.error || 'Failed to delete node');
            }

            // Refresh nodes
            await fetchNodes();
            return data.message || "The node has been successfully removed.";
        } catch (error) {
            throw error;
        } finally {
            setDeletingNodes(prev => {
                const newSet = new Set(prev);
                newSet.delete(node.id);
                return newSet;
            });
        }
    }, [fetchNodes]);

    return {
        nodes,
        isLoadingNodes,
        nodesError,
        deletingNodes,
        fetchNodes,
        createNode,
        deleteNode
    };
}
