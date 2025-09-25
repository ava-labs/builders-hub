import { useState, useEffect, useCallback } from 'react';
import type { ConsoleLog } from '@/types/console-log';

/**
 * Hook for managing console log/history
 * Handles fetching and adding console events to the history
 * History is persisted server-side for logged-in users
 */
export const useConsoleLog = () => {
  const [logs, setLogs] = useState<ConsoleLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch logs from API
  const fetchLogs = useCallback(async () => {
    // Don't load during SSR/SSG
    if (typeof window === 'undefined') return;
    
    setLoading(true);
    
    try {
      const response = await fetch('/api/console-log');
      if (response.ok) {
        const data = await response.json();
        const transformedLogs = data.map((item: any) => ({
          id: item.id,
          timestamp: new Date(item.created_at),
          status: item.status,
          actionPath: item.action_path,
          data: item.data
        }));
        setLogs(transformedLogs);
      } else if (response.status === 401) {
        // User not authenticated - this is expected
        setLogs([]);
      } else {
        console.error('Error loading console logs:', response.statusText);
        setLogs([]);
      }
    } catch (error) {
      console.error('Error loading console logs:', error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load logs on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    fetchLogs();
  }, [fetchLogs]);

  // Add a new log entry
  const addLog = async (item: Omit<ConsoleLog, 'id' | 'timestamp'>) => {
    // Don't add during SSR/SSG
    if (typeof window === 'undefined') return;
    
    try {
      const response = await fetch('/api/console-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: item.status,
          actionPath: item.actionPath,
          data: item.data
        })
      });

      if (response.ok) {
        const savedItem = await response.json();
        const logItem: ConsoleLog = {
          id: savedItem.id,
          timestamp: new Date(savedItem.created_at),
          status: savedItem.status,
          actionPath: savedItem.action_path,
          data: savedItem.data
        };
        setLogs(prev => [logItem, ...prev]);
      } else if (response.status === 401) {
        // User not authenticated - silently fail
        // History is only available for logged-in users
      } else {
        console.error('Failed to save log:', response.statusText);
      }
    } catch (error) {
      console.error('Error saving log:', error);
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
