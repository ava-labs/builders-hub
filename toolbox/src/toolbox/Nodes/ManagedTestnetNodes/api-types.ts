/**
 * Shared types for Managed Testnet Nodes API
 * These types represent the exact API responses and requests
 */

import { NodeRegistration } from './types';

// ============================================
// Request Types
// ============================================

export interface CreateNodeRequest {
  subnetId: string;
  blockchainId: string;
}

// ============================================
// Response Types
// ============================================

export interface ApiSuccessResponse<T = any> {
  success?: boolean;
  data?: T;
  message?: string;
}

export interface ApiErrorResponse {
  error: string;
  message: string;
}

// GET /api/managed-testnet-nodes
export interface GetNodesResponse {
  nodes: NodeRegistration[];
  total: number;
}

// POST /api/managed-testnet-nodes
export interface CreateNodeResponse {
  node: NodeRegistration;
  nodeID: string;
  nodePOP: {
    publicKey: string;
    proofOfPossession: string;
  };
  nodeIndex: number;
}

// DELETE /api/managed-testnet-nodes?id=NODE_DB_ID (account removal)
export interface DeleteNodeByIdResponse {
  success: true;
  message: string;
}

// DELETE /api/managed-testnet-nodes/[subnetId]/[nodeIndex] (full deletion)
export interface DeleteNodeResponse {
  success: boolean;
  deletedExternally: boolean;
  message: string;
  node?: {
    subnet_id: string;
    node_index: number;
    status: string;
  };
}

// ============================================
// Hook-specific derived types
// ============================================

/**
 * Node creation result - now directly uses CreateNodeResponse since API is flattened
 */
export type NodeCreationResult = CreateNodeResponse;

/**
 * Unified delete result for hook consumers
 */
export interface NodeDeletionResult {
  success: boolean;
  message: string;
  deletedExternally?: boolean;
  nodeId: string;
}

// ============================================
// API Client Types
// ============================================

export type ApiResponse<T> = Promise<T>;

export interface ManagedTestnetNodesApiClient {
  getNodes(): ApiResponse<GetNodesResponse>;
  createNode(request: CreateNodeRequest): ApiResponse<CreateNodeResponse>;
  deleteNodeById(nodeId: string): ApiResponse<DeleteNodeByIdResponse>;
  deleteNode(subnetId: string, nodeIndex: number): ApiResponse<DeleteNodeResponse>;
}

// ============================================
// Error Types
// ============================================

export interface ApiError extends Error {
  status?: number;
  code?: string;
  isAuthError?: boolean;
}

export class ManagedTestnetNodesApiError extends Error implements ApiError {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public isAuthError?: boolean
  ) {
    super(message);
    this.name = 'ManagedTestnetNodesApiError';
  }
}

// ============================================
// Type Guards
// ============================================

export function isApiErrorResponse(response: any): response is ApiErrorResponse {
  return response && typeof response.error === 'string';
}

export function isAuthError(error: any): boolean {
  return (
    error?.status === 401 || 
    error?.isAuthError === true ||
    error?.message?.includes('Authentication required') ||
    error?.message?.includes('401')
  );
}
