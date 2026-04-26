/**
 * MCPServer — central JSON-RPC 2.0 dispatcher for the unified Avalanche MCP server.
 *
 * Usage:
 *   const server = new MCPServer({ name, version, protocolVersion, description });
 *   server.registerToolDomain(docsTools);
 *   server.registerResourceDomain(docsResources);
 *   const response = await server.handlePost(body);
 */

import { jsonRpcMessageSchema } from './types';
import type {
  JsonRpcMessage,
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcResponse,
  MCPTool,
  MCPResource,
  ToolDomain,
  ResourceDomain,
} from './types';
import { captureMCPEvent, sanitizeErrorMessage } from './analytics';

// ---------------------------------------------------------------------------
// MCPServer class
// ---------------------------------------------------------------------------

interface ServerConfig {
  name: string;
  version: string;
  protocolVersion: string;
  description?: string;
}

// Cap how many JSON-RPC items a single batch can carry. The 60/min global rate limit only
// charges per HTTP request, so without this cap a single batch could amplify a client's quota.
export const MAX_BATCH_SIZE = 20;

export class MCPServer {
  private readonly config: ServerConfig;
  private toolDomains: ToolDomain[] = [];
  private resourceDomains: ResourceDomain[] = [];

  constructor(config: ServerConfig) {
    this.config = config;
  }

  registerToolDomain(domain: ToolDomain): void {
    this.toolDomains.push(domain);
  }

  registerResourceDomain(domain: ResourceDomain): void {
    this.resourceDomains.push(domain);
  }

  get allTools(): MCPTool[] {
    return this.toolDomains.flatMap((d) => d.tools);
  }

  get allResources(): MCPResource[] {
    return this.resourceDomains.flatMap((d) => d.resources);
  }

  getServerInfo(): object {
    return {
      name: this.config.name,
      version: this.config.version,
      protocolVersion: this.config.protocolVersion,
      description: this.config.description,
      tools: this.allTools,
      resources: this.allResources,
      endpoints: {
        rpc: '/api/mcp',
        docs: 'https://build.avax.network',
      },
    };
  }

  // -------------------------------------------------------------------------
  // Request processing
  // -------------------------------------------------------------------------

  private async processNotification(notification: JsonRpcNotification): Promise<void> {
    switch (notification.method) {
      case 'notifications/initialized':
        captureMCPEvent('mcp_initialized', {
          protocol_version: this.config.protocolVersion,
        });
        return;

      default:
        // Ignore unsupported notifications. Streamable HTTP clients do not
        // expect JSON-RPC responses for notifications.
        return;
    }
  }

  async processRequest(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    const { method, params, id } = request;

    try {
      let result: unknown;

      switch (method) {
        case 'initialize': {
          const clientInfo = params?.clientInfo as
            | { name?: string; version?: string }
            | undefined;

          captureMCPEvent('mcp_initialize', {
            client_name: clientInfo?.name || 'unknown',
            client_version: clientInfo?.version || 'unknown',
            protocol_version: this.config.protocolVersion,
          });

          result = {
            protocolVersion: this.config.protocolVersion,
            capabilities: {
              tools: {},
              resources: {},
            },
            serverInfo: {
              name: this.config.name,
              version: this.config.version,
            },
          };
          break;
        }

        case 'tools/list':
          result = { tools: this.allTools };
          break;

        case 'tools/call': {
          if (!params || typeof params.name !== 'string') {
            throw new Error('Invalid tool call: missing name');
          }
          const toolName = params.name;
          const toolArgs = (params.arguments as Record<string, unknown>) || {};

          const startTime = Date.now();
          let toolResult: unknown;
          let toolError: string | undefined;

          try {
            const handler = this.findToolHandler(toolName);
            if (!handler) {
              throw new Error(`Unknown tool: ${toolName}`);
            }
            toolResult = await handler(toolArgs);
          } catch (err) {
            toolError = sanitizeErrorMessage(err);
            toolResult = {
              // Use sanitized message in the user-facing payload too — raw err.message can
              // leak internal paths or library stack-trace fragments.
              content: [{ type: 'text', text: toolError }],
              isError: true,
            };
          }

          captureMCPEvent('mcp_tool_call', {
            tool: toolName,
            latency_ms: Date.now() - startTime,
            ...(toolError ? { error: toolError } : {}),
          });

          result = toolResult;
          break;
        }

        case 'resources/list':
          result = { resources: this.allResources };
          break;

        case 'resources/read': {
          if (!params || typeof params.uri !== 'string') {
            throw new Error('Invalid resource read: missing uri');
          }
          const uri = params.uri;
          const resourceHandler = this.findResourceHandler(uri);
          if (!resourceHandler) {
            throw new Error(`Unknown resource: ${uri}`);
          }

          const startTime = Date.now();
          result = await resourceHandler(uri);

          captureMCPEvent('mcp_resource_read', {
            uri,
            latency_ms: Date.now() - startTime,
          });
          break;
        }

        case 'ping':
          result = {};
          break;

        default:
          throw new Error(`Unknown method: ${method}`);
      }

      return { jsonrpc: '2.0', id, result };
    } catch (error) {
      captureMCPEvent('mcp_error', {
        method,
        error_type: error instanceof Error ? error.name : 'Error',
        error_message: sanitizeErrorMessage(error),
      });

      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: sanitizeErrorMessage(error),
        },
      };
    }
  }

  private async processMessage(message: JsonRpcMessage): Promise<JsonRpcResponse | null> {
    if ('id' in message && message.id !== undefined) {
      return this.processRequest(message);
    }

    await this.processNotification(message);
    return null;
  }

  /**
   * Entry point for POST handler — accepts either a single request or a batch.
   */
  async handlePost(body: unknown): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
    if (Array.isArray(body)) {
      if (body.length > MAX_BATCH_SIZE) {
        return {
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32600,
            message: `Batch size ${body.length} exceeds the maximum of ${MAX_BATCH_SIZE}`,
          },
        };
      }

      const responses = await Promise.all(
        body.map(async (message) => {
          const parsed = jsonRpcMessageSchema.safeParse(message);
          if (!parsed.success) {
            return {
              jsonrpc: '2.0' as const,
              id: this.getResponseId(message),
              error: { code: -32600, message: 'Invalid request' },
            };
          }
          return this.processMessage(parsed.data);
        })
      );

      const filteredResponses = responses.filter((response): response is JsonRpcResponse => response !== null);
      return filteredResponses.length > 0 ? filteredResponses : null;
    }

    const parsed = jsonRpcMessageSchema.safeParse(body);
    if (!parsed.success) {
      return {
        jsonrpc: '2.0',
        id: this.getResponseId(body),
        error: { code: -32600, message: 'Invalid request' },
      };
    }
    return this.processMessage(parsed.data);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private findToolHandler(name: string) {
    for (const domain of this.toolDomains) {
      if (domain.handlers[name]) return domain.handlers[name];
    }
    return undefined;
  }

  private getResponseId(message: unknown): string | number | null {
    if (!message || typeof message !== 'object' || !('id' in message)) {
      return null;
    }

    const id = (message as { id?: unknown }).id;
    if (typeof id === 'string' || typeof id === 'number' || id === null) {
      return id;
    }

    return null;
  }

  private findResourceHandler(uri: string) {
    for (const domain of this.resourceDomains) {
      const resource = domain.resources.find((r) => r.uri === uri);
      if (resource) return domain.handler;
    }
    return undefined;
  }
}
