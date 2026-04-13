"use client";

import { useState, useCallback } from "react";
import { Relayer, RelayerConfig } from "@/components/toolbox/console/testnet-infra/managed-testnet-relayers/types";
import posthog from 'posthog-js';
import { apiFetch, ApiClientError } from '@/lib/api/client';

export function useManagedTestnetRelayers() {
    const [relayers, setRelayers] = useState<Relayer[]>([]);
    const [isLoadingRelayers, setIsLoadingRelayers] = useState(true);
    const [relayersError, setRelayersError] = useState<string | null>(null);
    const [deletingRelayers, setDeletingRelayers] = useState<Set<string>>(new Set());
    const [restartingRelayers, setRestartingRelayers] = useState<Set<string>>(new Set());

    const fetchRelayers = useCallback(async () => {
        setIsLoadingRelayers(true);
        setRelayersError(null);

        try {
            const data = await apiFetch<{ relayers?: Relayer[] }>('/api/managed-testnet-relayers');

            if (data.relayers) {
                setRelayers(data.relayers);
            }
        } catch (error) {
            console.error("Failed to fetch relayers:", error);
            setRelayersError(error instanceof Error ? error.message : 'Failed to fetch relayers');
        } finally {
            setIsLoadingRelayers(false);
        }
    }, []);

    const createRelayer = useCallback(async (configs: RelayerConfig[]) => {
        try {
            const data = await apiFetch<{ relayer: Relayer }>('/api/managed-testnet-relayers', {
                method: 'POST',
                body: { configs }
            });

            return data.relayer;
        } catch (error) {
            if (error instanceof ApiClientError && error.status === 429) {
                throw new Error(error.message || "Rate limit exceeded. Please try again later.");
            }
            throw error;
        }
    }, []);

    const deleteRelayer = useCallback(async (relayer: Relayer) => {
        setDeletingRelayers(prev => new Set(prev).add(relayer.relayerId));

        try {
            const data = await apiFetch<{ message?: string }>(`/api/managed-testnet-relayers/${relayer.relayerId}`, {
                method: 'DELETE',
            });

            // Track successful deletion
            posthog.capture('managed_testnet_relayer_deleted', {
                relayer_id: relayer.relayerId,
                config_count: relayer.configs.length,
                context: 'console'
            });

            // Refresh relayers
            await fetchRelayers();
            return data.message || "The relayer has been successfully removed.";
        } catch (error) {
            // Track error
            posthog.capture('managed_testnet_relayer_delete_error', {
                relayer_id: relayer.relayerId,
                config_count: relayer.configs.length,
                error_message: error instanceof Error ? error.message : 'Failed to delete relayer',
                context: 'console'
            });
            throw error;
        } finally {
            setDeletingRelayers(prev => {
                const newSet = new Set(prev);
                newSet.delete(relayer.relayerId);
                return newSet;
            });
        }
    }, [fetchRelayers]);

    const restartRelayer = useCallback(async (relayer: Relayer) => {
        setRestartingRelayers(prev => new Set(prev).add(relayer.relayerId));

        try {
            const data = await apiFetch<{ message?: string }>(`/api/managed-testnet-relayers/${relayer.relayerId}/restart`, {
                method: 'POST',
            });

            // Track successful restart
            posthog.capture('managed_testnet_relayer_restarted', {
                relayer_id: relayer.relayerId,
                config_count: relayer.configs.length,
                context: 'console'
            });

            // Refresh relayers to get updated status
            await fetchRelayers();
            return data.message || "The relayer has been restarted successfully.";
        } catch (error) {
            // Track error
            const isRateLimited = error instanceof ApiClientError && error.status === 429;
            posthog.capture('managed_testnet_relayer_restart_error', {
                relayer_id: relayer.relayerId,
                config_count: relayer.configs.length,
                error_message: error instanceof Error ? error.message : 'Failed to restart relayer',
                is_rate_limited: isRateLimited,
                context: 'console'
            });
            if (isRateLimited) {
                throw new Error('Rate limit exceeded. Please wait before restarting again.');
            }
            throw error;
        } finally {
            setRestartingRelayers(prev => {
                const newSet = new Set(prev);
                newSet.delete(relayer.relayerId);
                return newSet;
            });
        }
    }, [fetchRelayers]);

    return {
        relayers,
        isLoadingRelayers,
        relayersError,
        deletingRelayers,
        restartingRelayers,
        fetchRelayers,
        createRelayer,
        deleteRelayer,
        restartRelayer
    };
}

