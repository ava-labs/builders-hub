"use client";

import { useState, useCallback } from "react";
import { NodeRegistration, RegisterSubnetResponse } from "@/components/toolbox/console/testnet-infra/ManagedTestnetNodes/types";
import posthog from 'posthog-js';

// Custom error for node already exists scenario
class NodeAlreadyExistsError extends Error {
    existingNode: NodeRegistration;

    constructor(existingNode: NodeRegistration) {
        super(
            `You already have an active node for this subnet (${existingNode.subnet_id.slice(0, 8)}...). ` +
            `Each user can only have one active node per subnet. ` +
            `Please delete your existing node first if you want to create a new one, or wait for it to expire.`
        );
        this.name = 'NodeAlreadyExistsError';
        this.existingNode = existingNode;
    }
}

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

    // Check if user already has an active node for a given subnet
    const checkExistingNode = useCallback((subnetId: string): NodeRegistration | null => {
        const existingNode = nodes.find(
            (node) => node.subnet_id === subnetId && node.status !== 'deleted' && node.status !== 'expired'
        );
        return existingNode || null;
    }, [nodes]);

    const createNode = useCallback(async (subnetId: string, blockchainId: string) => {
        // Check for existing active node before making API call
        const existingNode = checkExistingNode(subnetId);
        if (existingNode) {
            throw new NodeAlreadyExistsError(existingNode);
        }

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
                // Handle 409 Conflict - node already exists (server-side check)
                if (response.status === 409) {
                    const errorMessage = data.message || data.error || '';
                    throw new Error(
                        `A node already exists for this subnet. ${errorMessage} ` +
                        `Please delete your existing node first, or wait for it to expire before creating a new one.`
                    );
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
    }, [checkExistingNode]);

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
                // Track error
                posthog.capture('managed_testnet_node_delete_error', {
                    subnet_id: node.subnet_id,
                    blockchain_id: node.blockchain_id,
                    error_message: data.message || data.error || 'Failed to delete node',
                    context: 'console'
                });
                throw new Error(data.message || data.error || 'Failed to delete node');
            }

            // Track successful deletion
            posthog.capture('managed_testnet_node_deleted', {
                subnet_id: node.subnet_id,
                blockchain_id: node.blockchain_id,
                context: 'console'
            });

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
        deleteNode,
        checkExistingNode
    };
}
