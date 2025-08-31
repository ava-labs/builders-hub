/**
 * API Client for Managed Testnet Nodes
 * Provides typed HTTP client for all node management operations
 */

import { 
  CreateNodeRequest,
  CreateNodeResponse,
  GetNodesResponse,
  DeleteNodeByIdResponse,
  DeleteNodeResponse,
  ManagedTestnetNodesApiClient,
  ManagedTestnetNodesApiError,
  isApiErrorResponse,
  isAuthError
} from './api-types';

class ApiClient implements ManagedTestnetNodesApiClient {
  private async request<T>(
    url: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers: defaultHeaders,
      });

      let data: any;
      try {
        data = await response.json();
      } catch {
        throw new ManagedTestnetNodesApiError(
          'Invalid JSON response from server',
          response.status
        );
      }

      if (!response.ok || isApiErrorResponse(data)) {
        const errorMessage = data.message || data.error || `Request failed with status ${response.status}`;
        throw new ManagedTestnetNodesApiError(
          errorMessage,
          response.status,
          data.error,
          isAuthError(data) || response.status === 401
        );
      }

      return data as T;
    } catch (error) {
      if (error instanceof ManagedTestnetNodesApiError) {
        throw error;
      }

      // Handle network errors
      throw new ManagedTestnetNodesApiError(
        error instanceof Error ? error.message : 'Network request failed'
      );
    }
  }

  async getNodes(): Promise<GetNodesResponse> {
    return this.request<GetNodesResponse>('/api/managed-testnet-nodes', {
      method: 'GET',
    });
  }

  async createNode(request: CreateNodeRequest): Promise<CreateNodeResponse> {
    return this.request<CreateNodeResponse>('/api/managed-testnet-nodes', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async deleteNodeById(nodeId: string): Promise<DeleteNodeByIdResponse> {
    const url = `/api/managed-testnet-nodes?id=${encodeURIComponent(nodeId)}`;
    return this.request<DeleteNodeByIdResponse>(url, {
      method: 'DELETE',
    });
  }

  async deleteNode(subnetId: string, nodeIndex: number): Promise<DeleteNodeResponse> {
    const url = `/api/managed-testnet-nodes/${encodeURIComponent(subnetId)}/${nodeIndex}`;
    return this.request<DeleteNodeResponse>(url, {
      method: 'DELETE',
    });
  }
}

// Export singleton instance
export const managedTestnetNodesApi = new ApiClient();

// Export class for testing/mocking
export { ApiClient as ManagedTestnetNodesApiClient };
