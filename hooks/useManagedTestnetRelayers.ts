"use client";

import { useState, useCallback } from "react";
import { Relayer, RelayerConfig } from "@/components/toolbox/console/testnet-infra/ManagedTestnetRelayers/types";
import { analytics } from '@/lib/analytics';

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
            const response = await fetch('/api/managed-testnet-relayers', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                throw new Error(data.message || data.error || 'Failed to fetch relayers');
            }

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
            const response = await fetch('/api/managed-testnet-relayers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ configs })
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error(data.message || data.error || "Rate limit exceeded. Please try again later.");
                }
                throw new Error(data.message || data.error || `Error ${response.status}: Failed to create relayer`);
            }

            if (data.error) {
                throw new Error(data.message || data.error || 'Relayer creation failed');
            }

            return data.relayer as Relayer;
        } catch (error) {
            throw error;
        }
    }, []);

    const deleteRelayer = useCallback(async (relayer: Relayer) => {
        setDeletingRelayers(prev => new Set(prev).add(relayer.relayerId));

        try {
            const response = await fetch(`/api/managed-testnet-relayers/${relayer.relayerId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                // Track error
                analytics.infra.relayerDeleteError(
                    relayer.relayerId,
                    relayer.configs.length,
                    data.message || data.error || 'Failed to delete relayer'
                );
                throw new Error(data.message || data.error || 'Failed to delete relayer');
            }

            // Track successful deletion
            analytics.infra.relayerDeleted(relayer.relayerId, relayer.configs.length);

            // Refresh relayers
            await fetchRelayers();
            return data.message || "The relayer has been successfully removed.";
        } catch (error) {
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
            const response = await fetch(`/api/managed-testnet-relayers/${relayer.relayerId}/restart`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const data = await response.json();

            if (!response.ok || data.error) {
                // Track error
                const isRateLimited = response.status === 429;
                analytics.infra.relayerRestartError(
                    relayer.relayerId,
                    relayer.configs.length,
                    data.message || data.error || 'Failed to restart relayer',
                    isRateLimited
                );
                if (isRateLimited) {
                    throw new Error('Rate limit exceeded. Please wait before restarting again.');
                }
                throw new Error(data.message || data.error || 'Failed to restart relayer');
            }

            // Track successful restart
            analytics.infra.relayerRestarted(relayer.relayerId, relayer.configs.length);

            // Refresh relayers to get updated status
            await fetchRelayers();
            return data.message || "The relayer has been restarted successfully.";
        } catch (error) {
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

