/**
 * Custom hook for managing testnet nodes
 * Encapsulates all CRUD operations with precise typing and state management
 */

import { useState, useEffect, useCallback } from 'react';
import { managedTestnetNodesApi } from './api-client';
import { 
  NodeCreationResult, 
  NodeDeletionResult, 
  ManagedTestnetNodesApiError,
  CreateNodeRequest
} from './api-types';
import { NodeRegistration } from './types';

export interface UseManagedTestnetNodesState {
  // Data state
  nodes: NodeRegistration[];
  
  // Loading states
  isLoading: boolean;
  isCreating: boolean;
  deletingNodes: Set<string>;
  
  // Error states
  error: string | null;
  lastError: ManagedTestnetNodesApiError | null;
}

export interface UseManagedTestnetNodesActions {
  // Core operations
  fetchNodes: () => Promise<void>;
  createNode: (request: CreateNodeRequest) => Promise<NodeCreationResult>;
  deleteNode: (node: NodeRegistration) => Promise<NodeDeletionResult>;
  
  // Utility operations
  refetch: () => Promise<void>;
  clearError: () => void;
  
  // Derived getters
  getNodeById: (id: string) => NodeRegistration | undefined;
  canCreateNode: boolean;
}

export interface UseManagedTestnetNodesReturn extends UseManagedTestnetNodesState, UseManagedTestnetNodesActions {}

const MAX_NODES_PER_USER = 3;

export function useManagedTestnetNodes(): UseManagedTestnetNodesReturn {
  // State management
  const [nodes, setNodes] = useState<NodeRegistration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingNodes, setDeletingNodes] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [lastError, setLastError] = useState<ManagedTestnetNodesApiError | null>(null);

  // Clear error utility
  const clearError = useCallback(() => {
    setError(null);
    setLastError(null);
  }, []);

  // Handle API errors consistently
  const handleApiError = useCallback((apiError: unknown, defaultMessage: string) => {
    if (apiError instanceof ManagedTestnetNodesApiError) {
      setError(apiError.message);
      setLastError(apiError);
    } else if (apiError instanceof Error) {
      setError(apiError.message);
      setLastError(new ManagedTestnetNodesApiError(apiError.message));
    } else {
      setError(defaultMessage);
      setLastError(new ManagedTestnetNodesApiError(defaultMessage));
    }
  }, []);

  // Fetch nodes from API
  const fetchNodes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await managedTestnetNodesApi.getNodes();
      setNodes(response.nodes);
    } catch (apiError) {
      console.error('Failed to fetch nodes:', apiError);
      handleApiError(apiError, 'Failed to fetch nodes');
    } finally {
      setIsLoading(false);
    }
  }, [handleApiError]);

  // Create a new node
  const createNode = useCallback(async (request: CreateNodeRequest): Promise<NodeCreationResult> => {
    setIsCreating(true);
    setError(null);

    try {
      const response = await managedTestnetNodesApi.createNode(request);
      
      // API response is now flattened, no transformation needed
      // Automatically refetch nodes to keep state in sync
      await fetchNodes();

      return response;
    } catch (apiError) {
      console.error('Failed to create node:', apiError);
      handleApiError(apiError, 'Failed to create node');
      throw apiError;
    } finally {
      setIsCreating(false);
    }
  }, [fetchNodes, handleApiError]);

  // Delete a node
  const deleteNode = useCallback(async (node: NodeRegistration): Promise<NodeDeletionResult> => {
    setDeletingNodes(prev => new Set(prev).add(node.id));
    setError(null);

    try {
      let response;
      
      // Choose deletion strategy based on whether we have node_index
      if (node.node_index === null || node.node_index === undefined) {
        // Account-only removal for nodes without node_index
        response = await managedTestnetNodesApi.deleteNodeById(node.id);
        
        const result: NodeDeletionResult = {
          success: response.success,
          message: response.message,
          nodeId: node.id,
        };

        // Automatically refetch nodes to keep state in sync
        await fetchNodes();
        
        return result;
      } else {
        // Full deletion from Builder Hub and DB
        response = await managedTestnetNodesApi.deleteNode(node.subnet_id, node.node_index);
        
        const result: NodeDeletionResult = {
          success: response.success,
          message: response.message,
          deletedExternally: response.deletedExternally,
          nodeId: node.id,
        };

        // Automatically refetch nodes to keep state in sync
        await fetchNodes();
        
        return result;
      }
    } catch (apiError) {
      console.error('Failed to delete node:', apiError);
      handleApiError(apiError, 'Failed to delete node');
      throw apiError;
    } finally {
      setDeletingNodes(prev => {
        const newSet = new Set(prev);
        newSet.delete(node.id);
        return newSet;
      });
    }
  }, [fetchNodes, handleApiError]);

  // Utility functions
  const refetch = useCallback(() => fetchNodes(), [fetchNodes]);

  const getNodeById = useCallback((id: string) => {
    return nodes.find(node => node.id === id);
  }, [nodes]);

  const canCreateNode = nodes.length < MAX_NODES_PER_USER;

  // Initial load
  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  return {
    // State
    nodes,
    isLoading,
    isCreating,
    deletingNodes,
    error,
    lastError,
    
    // Actions
    fetchNodes,
    createNode,
    deleteNode,
    refetch,
    clearError,
    
    // Utilities
    getNodeById,
    canCreateNode,
  };
}
