"use client";

import { useState, useCallback } from "react";
import { NodeRegistration, RegisterSubnetResponse } from "@/components/toolbox/console/testnet-infra/managed-testnet-nodes/types";
import posthog from 'posthog-js';
import { useConsoleBadgeNotificationStore, type ConsoleBadgeNotification } from '@/stores/consoleBadgeNotificationStore';
import { apiFetch, ApiClientError } from '@/lib/api/client';

export function useManagedTestnetNodes() {
    const [nodes, setNodes] = useState<NodeRegistration[]>([]);
    const [isLoadingNodes, setIsLoadingNodes] = useState(true);
    const [nodesError, setNodesError] = useState<string | null>(null);
    const [deletingNodes, setDeletingNodes] = useState<Set<string>>(new Set());

    const fetchNodes = useCallback(async () => {
        setIsLoadingNodes(true);
        setNodesError(null);

        try {
            const data = await apiFetch<{ nodes?: NodeRegistration[] }>('/api/managed-testnet-nodes');

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
            const data = await apiFetch<{ builder_hub_response?: RegisterSubnetResponse; awardedBadges?: ConsoleBadgeNotification[] }>('/api/managed-testnet-nodes', {
                method: 'POST',
                body: { subnetId, blockchainId }
            });

            if (data.awardedBadges?.length) {
                useConsoleBadgeNotificationStore.getState().addBadges(data.awardedBadges);
            }

            if (data.builder_hub_response) {
                return data.builder_hub_response;
            } else {
                throw new Error('Unexpected response format');
            }
        } catch (error) {
            if (error instanceof ApiClientError && error.status === 429) {
                throw new Error(error.message || "Rate limit exceeded. Please try again later.");
            }
            throw error;
        }
    }, []);

    const deleteNode = useCallback(async (node: NodeRegistration) => {
        setDeletingNodes(prev => new Set(prev).add(node.id));

        try {
            const url = (node.node_index === null || node.node_index === undefined)
                ? `/api/managed-testnet-nodes?id=${encodeURIComponent(node.id)}`
                : `/api/managed-testnet-nodes/${node.subnet_id}/${node.node_index}`;

            const data = await apiFetch<{ message?: string }>(url, { method: 'DELETE' });

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
            // Track error
            posthog.capture('managed_testnet_node_delete_error', {
                subnet_id: node.subnet_id,
                blockchain_id: node.blockchain_id,
                error_message: error instanceof Error ? error.message : 'Failed to delete node',
                context: 'console'
            });
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
