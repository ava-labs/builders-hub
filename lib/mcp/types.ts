/**
 * Shared types for the unified Avalanche MCP server.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------

export type Network = 'mainnet' | 'fuji';

// ---------------------------------------------------------------------------
// Tool types (MCP spec)
// ---------------------------------------------------------------------------

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult>;

export interface ToolDomain {
  tools: MCPTool[];
  handlers: Record<string, ToolHandler>;
}

// ---------------------------------------------------------------------------
// Resource types (MCP spec)
// ---------------------------------------------------------------------------

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface ResourceContents {
  uri: string;
  mimeType?: string;
  text: string;
}

export type ResourceHandler = (uri: string) => Promise<{ contents: ResourceContents[] }>;

export interface ResourceDomain {
  resources: MCPResource[];
  handler: ResourceHandler;
}

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 types
// ---------------------------------------------------------------------------

const jsonRpcIdSchema = z.union([z.string(), z.number(), z.null()]);

const jsonRpcBaseMessageSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});

export const jsonRpcRequestSchema = jsonRpcBaseMessageSchema.extend({
  id: jsonRpcIdSchema,
});

export const jsonRpcNotificationSchema = jsonRpcBaseMessageSchema.extend({
  id: z.never().optional(),
});

export const jsonRpcMessageSchema = z.union([
  jsonRpcRequestSchema,
  jsonRpcNotificationSchema,
]);

export type JsonRpcRequest = z.infer<typeof jsonRpcRequestSchema>;
export type JsonRpcNotification = z.infer<typeof jsonRpcNotificationSchema>;
export type JsonRpcMessage = z.infer<typeof jsonRpcMessageSchema>;

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// ---------------------------------------------------------------------------
// Validation schemas for Avalanche addresses / IDs
// ---------------------------------------------------------------------------

/** CB58-encoded transaction / subnet ID (43–52 chars of base58 alphabet) */
export const TxIdSchema = z.string().regex(
  /^[1-9A-HJ-NP-Za-km-z]{43,52}$/,
  'Must be a valid CB58-encoded ID'
);

/** Same pattern as TxIdSchema */
export const SubnetIdSchema = TxIdSchema;

/** NodeID-... format */
export const NodeIdSchema = z.string().regex(
  /^NodeID-[1-9A-HJ-NP-Za-km-z]+$/,
  'Must be a valid NodeID (e.g. NodeID-AbC...)'
);

/** P-Chain address (P-avax1... or P-fuji1...) */
export const PChainAddressSchema = z.string().regex(
  /^P-(avax|fuji|custom|local)1[a-z0-9]+$/,
  'Must be a valid P-Chain address (e.g. P-avax1...)'
);
