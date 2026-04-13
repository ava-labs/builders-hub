import { useState, useEffect, useCallback } from 'react';
import type { ConsoleLog, ConsoleLogStatus } from '@/types/console-log';
import { useConsoleBadgeNotificationStore, type ConsoleBadgeNotification } from '@/stores/consoleBadgeNotificationStore';
import { apiFetch, ApiClientError } from '@/lib/api/client';

/**
 * Hook for managing console log/history
 * Handles fetching and adding console events to the history
 * History is persisted server-side for logged-in users
 * @param autoFetch - Whether to automatically fetch logs on mount (default: false)
 */
export const useConsoleLog = (autoFetch: boolean = false) => {
  const [logs, setLogs] = useState<ConsoleLog[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch logs from API
  const fetchLogs = useCallback(async () => {
    // Don't load during SSR/SSG
    if (typeof window === 'undefined') return;
    
    setLoading(true);
    
    try {
      const data = await apiFetch<Array<{ id: string; created_at: string; status: ConsoleLogStatus; action_path: string; data: Record<string, any> }>>('/api/console-log');
      const transformedLogs: ConsoleLog[] = data.map((item) => ({
        id: item.id,
        timestamp: new Date(item.created_at),
        status: item.status,
        actionPath: item.action_path,
        data: item.data
      }));
      setLogs(transformedLogs);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        // User not authenticated - this is expected, don't log error
        setLogs([]);
      } else {
        console.error('Error loading console logs:', error);
        setLogs([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Only load logs on mount if autoFetch is true
  useEffect(() => {
    if (typeof window === 'undefined' || !autoFetch) return;
    fetchLogs();
  }, [fetchLogs, autoFetch]);

  // Add a new log entry
  const addLog = async (item: Omit<ConsoleLog, 'id' | 'timestamp'>) => {
    // Don't add during SSR/SSG
    if (typeof window === 'undefined') return;
    
    try {
      const savedItem = await apiFetch<{ id: string; created_at: string; status: ConsoleLogStatus; action_path: string; data: Record<string, any>; awardedBadges?: ConsoleBadgeNotification[] }>('/api/console-log', {
        method: 'POST',
        body: {
          status: item.status,
          actionPath: item.actionPath,
          data: item.data,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      });

      if (savedItem.awardedBadges?.length) {
        useConsoleBadgeNotificationStore.getState().addBadges(savedItem.awardedBadges);
      }
      const logItem: ConsoleLog = {
        id: savedItem.id,
        timestamp: new Date(savedItem.created_at),
        status: savedItem.status,
        actionPath: savedItem.action_path,
        data: savedItem.data
      };
      setLogs(prev => [logItem, ...prev]);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        // User not authenticated - silently fail
        // History is only available for logged-in users
      } else {
        console.error('Error saving log:', error);
      }
    }
  };

  // Helper function to get explorer URL
  const getExplorerUrl = (id: string, type: 'tx' | 'address', network: string, chain: string = 'P'): string => {
    const base = network === 'mainnet' 
      ? 'https://subnets.avax.network' 
      : 'https://subnets-test.avax.network';
    
    if (chain === 'P') {
      return `${base}/p-chain/${type}/${id}`;
    }
    return `${base}/c-chain/${type}/${id}`;
  };

  return {
    logs,
    loading,
    addLog,
    fetchLogs,
    getExplorerUrl
  };
};
