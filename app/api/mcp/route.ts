import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { documentation, academy, integration, blog } from '@/lib/source';
import { getLLMText } from '@/lib/llm-utils';
import { captureServerEvent } from '@/lib/posthog-server';
import { checkMCPRateLimit, getRateLimitHeaders } from '@/lib/mcp-rate-limit';

// Maximum length for tracked strings (queries, errors)
const MAX_TRACKED_STRING_LENGTH = 100;

// CORS configuration - allowed origins for browser requests
// Non-browser clients (no Origin header) are always allowed
const ALLOWED_ORIGINS = process.env.MCP_ALLOWED_ORIGINS?.split(',') || [
  'https://claude.ai',
  'https://www.claude.ai',
  'https://build.avax.network',
  ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : []),
];

/**
 * Truncate a string for analytics tracking.
 */
function truncateForTracking(str: string): string {
  if (str.length <= MAX_TRACKED_STRING_LENGTH) return str;
  return str.slice(0, MAX_TRACKED_STRING_LENGTH - 3) + '...';
}

/**
 * Sanitize an error message for analytics (remove potentially sensitive info).
 */
function sanitizeErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) return 'Unknown error';
  // Only return the error name and a truncated message
  const name = error.name || 'Error';
  const message = truncateForTracking(error.message);
  return `${name}: ${message}`;
}

// Helper to capture MCP-specific events
function captureMCPEvent(event: string, properties: Record<string, unknown>) {
  // Intentionally not awaited - analytics should not block MCP responses
  void captureServerEvent(event, { ...properties, source: 'mcp-server' }, 'mcp_server');
}

/**
 * Validate origin for CORS
 * Returns true if origin is allowed or if no origin (non-browser client)
 */
function validateOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');

  // Allow non-browser clients (no Origin header)
  if (!origin) return true;

  // Check against allowlist
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * Get CORS headers for response
 */
function getCORSHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');

  if (!origin) {
    // No origin header - non-browser client, no CORS headers needed
    return {};
  }

  if (ALLOWED_ORIGINS.includes(origin)) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      'Vary': 'Origin',
    };
  }

  return {};
}

/**
 * Validate URL for fetch tool to prevent SSRF
 */
function validateFetchUrl(url: string): { valid: boolean; error?: string } {
  // Must start with /
  if (!url.startsWith('/')) {
    return { valid: false, error: 'URL must start with /' };
  }

  // Reject external URLs, protocols, and path traversal
  if (url.includes('://') || url.includes('..')) {
    return { valid: false, error: 'URL must be an internal path without ".." or protocols' };
  }

  // Only allow specific prefixes
  const allowedPrefixes = ['/docs/', '/academy/', '/integrations/', '/blog/'];
  if (!allowedPrefixes.some(prefix => url.startsWith(prefix))) {
    return {
      valid: false,
      error: `URL must start with one of: ${allowedPrefixes.join(', ')}`
    };
  }

  return { valid: true };
}

// Helper to get page content
async function getPageContent(url: string): Promise<string | null> {
  // Find page in all sources
  const allPages = [
    ...documentation.getPages(),
    ...academy.getPages(),
    ...integration.getPages(),
    ...blog.getPages(),
  ];

  const page = allPages.find((p) => p.url === url);
  if (!page) return null;

  try {
    return await getLLMText(page);
  } catch (error) {
    console.error(`Error getting content for ${url}:`, error);
    return null;
  }
}

// Search function that searches across all documentation
function searchDocs(
  query: string,
  options: { source?: string; limit?: number } = {}
): Array<{ url: string; title: string; description?: string; source: string; score: number }> {
  // Defensive check for undefined/null query
  if (!query || typeof query !== 'string') {
    console.warn('searchDocs called with invalid query:', query);
    return [];
  }

  const { source, limit = 10 } = options;
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 2);

  const results: Array<{
    url: string;
    title: string;
    description?: string;
    source: string;
    score: number;
  }> = [];

  // Get pages from selected sources
  const sources: Array<{
    name: string;
    pages: Array<{ url: string; data: { title: string; description?: string } }>;
  }> = [];

  if (!source || source === 'docs') {
    sources.push({ name: 'docs', pages: documentation.getPages() });
  }
  if (!source || source === 'academy') {
    sources.push({ name: 'academy', pages: academy.getPages() });
  }
  if (!source || source === 'integrations') {
    sources.push({ name: 'integrations', pages: integration.getPages() });
  }
  if (!source || source === 'blog') {
    sources.push({ name: 'blog', pages: blog.getPages() });
  }

  for (const { name, pages } of sources) {
    for (const page of pages) {
      const titleLower = page.data.title?.toLowerCase() || '';
      const descLower = page.data.description?.toLowerCase() || '';
      const urlLower = page.url.toLowerCase();

      let score = 0;

      // Score based on query terms
      for (const term of queryTerms) {
        if (titleLower.includes(term)) score += 20;
        if (descLower.includes(term)) score += 10;
        if (urlLower.includes(term)) score += 5;
      }

      // Bonus for exact phrase match
      if (titleLower.includes(queryLower)) score += 30;
      if (descLower.includes(queryLower)) score += 15;

      if (score > 0) {
        results.push({
          url: page.url,
          title: page.data.title || 'Untitled',
          description: page.data.description,
          source: name,
          score,
        });
      }
    }
  }

  // Sort by score and limit results
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

// MCP Server Info
const SERVER_INFO = {
  name: 'avalanche-docs',
  version: '1.0.0',
  protocolVersion: '2024-11-05',
};

// Tool definitions following MCP spec
const TOOLS = [
  {
    name: 'avalanche_docs_search',
    description: 'Search across Avalanche documentation, academy courses, integrations, and blog posts',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query',
        },
        source: {
          type: 'string',
          enum: ['docs', 'academy', 'integrations', 'blog'],
          description: 'Filter by documentation source (optional)',
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 50,
          description: 'Maximum number of results (default: 10)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'avalanche_docs_fetch',
    description: 'Fetch a specific documentation page as markdown',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The page URL path (e.g., /docs/primary-network/overview)',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'avalanche_docs_list_sections',
    description: 'List available documentation sections and their page counts',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

// Resource definitions
const RESOURCES = [
  {
    uri: 'docs://index',
    name: 'Documentation Index',
    description: 'Index of all Avalanche documentation pages',
    mimeType: 'text/markdown',
  },
  {
    uri: 'academy://index',
    name: 'Academy Index',
    description: 'Index of all Avalanche Academy courses',
    mimeType: 'text/markdown',
  },
  {
    uri: 'integrations://index',
    name: 'Integrations Index',
    description: 'Index of all Avalanche integrations',
    mimeType: 'text/markdown',
  },
];

// Handle tool calls
async function handleToolCall(name: string, args: Record<string, unknown>) {
  const startTime = Date.now();

  switch (name) {
    case 'avalanche_docs_search': {
      const query = typeof args.query === 'string' ? args.query : '';
      const source = typeof args.source === 'string' ? args.source : undefined;
      const limit = typeof args.limit === 'number' ? args.limit : undefined;

      if (!query) {
        return {
          content: [{ type: 'text', text: 'Error: query parameter is required' }],
        };
      }

      const results = searchDocs(query, { source, limit });
      const latencyMs = Date.now() - startTime;

      // Track search event (truncate query for privacy/size)
      captureMCPEvent('mcp_search', {
        query: query ? truncateForTracking(query) : '',
        source_filter: source || 'all',
        result_count: results.length,
        latency_ms: latencyMs,
      });

      if (results.length === 0) {
        return {
          content: [{ type: 'text', text: `No results found for "${query}"` }],
        };
      }

      const formattedResults = results
        .map(
          (r) =>
            `- [${r.title}](https://build.avax.network${r.url}) (${r.source})${r.description ? `\n  ${r.description}` : ''}`
        )
        .join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Found ${results.length} results for "${query}":\n\n${formattedResults}`,
          },
        ],
      };
    }

    case 'avalanche_docs_fetch': {
      const url = args.url as string;

      // Validate URL to prevent SSRF
      const validation = validateFetchUrl(url);
      if (!validation.valid) {
        return {
          content: [{ type: 'text', text: `Invalid URL: ${validation.error}` }],
        };
      }

      const normalizedUrl = url.startsWith('/') ? url : `/${url}`;

      const content = await getPageContent(normalizedUrl);
      const latencyMs = Date.now() - startTime;

      // Track fetch event
      captureMCPEvent('mcp_fetch', {
        url: normalizedUrl,
        found: !!content,
        latency_ms: latencyMs,
      });

      if (!content) {
        return {
          content: [{ type: 'text', text: `Page not found: ${normalizedUrl}` }],
        };
      }

      return {
        content: [{ type: 'text', text: content }],
      };
    }

    case 'avalanche_docs_list_sections': {
      const docPages = documentation.getPages();
      const academyPages = academy.getPages();
      const integrationPages = integration.getPages();
      const blogPages = blog.getPages();

      // Group docs by top-level section
      const docSections: Record<string, number> = {};
      for (const page of docPages) {
        const parts = page.url.split('/').filter(Boolean);
        if (parts.length >= 2) {
          const section = parts[1];
          docSections[section] = (docSections[section] || 0) + 1;
        }
      }

      // Group academy by course
      const academySections: Record<string, number> = {};
      for (const page of academyPages) {
        const parts = page.url.split('/').filter(Boolean);
        if (parts.length >= 2) {
          const section = parts[1];
          academySections[section] = (academySections[section] || 0) + 1;
        }
      }

      let text = '# Available Documentation Sections\n\n';

      text += '## Documentation\n';
      for (const [section, count] of Object.entries(docSections).sort((a, b) => b[1] - a[1])) {
        text += `- ${section}: ${count} pages\n`;
      }

      text += '\n## Academy Courses\n';
      for (const [section, count] of Object.entries(academySections).sort((a, b) => b[1] - a[1])) {
        text += `- ${section}: ${count} pages\n`;
      }

      text += `\n## Integrations\n- ${integrationPages.length} integration pages\n`;
      text += `\n## Blog\n- ${blogPages.length} blog posts\n`;

      const latencyMs = Date.now() - startTime;

      // Track list sections event
      captureMCPEvent('mcp_list_sections', {
        latency_ms: latencyMs,
      });

      return {
        content: [{ type: 'text', text }],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Handle resource reads
async function handleResourceRead(uri: string) {
  const startTime = Date.now();

  switch (uri) {
    case 'docs://index': {
      const docPages = documentation.getPages();
      const content = docPages
        .map((p) => `- [${p.data.title}](${p.url})${p.data.description ? `: ${p.data.description}` : ''}`)
        .join('\n');

      // Track resource read event
      captureMCPEvent('mcp_resource_read', {
        uri,
        latency_ms: Date.now() - startTime,
      });

      return {
        contents: [
          {
            uri,
            mimeType: 'text/markdown',
            text: `# Avalanche Documentation Index\n\n${content}`,
          },
        ],
      };
    }

    case 'academy://index': {
      const academyPages = academy.getPages();
      const content = academyPages
        .map((p) => `- [${p.data.title}](${p.url})${p.data.description ? `: ${p.data.description}` : ''}`)
        .join('\n');

      // Track resource read event
      captureMCPEvent('mcp_resource_read', {
        uri,
        latency_ms: Date.now() - startTime,
      });

      return {
        contents: [
          {
            uri,
            mimeType: 'text/markdown',
            text: `# Avalanche Academy Courses\n\n${content}`,
          },
        ],
      };
    }

    case 'integrations://index': {
      const integrationPages = integration.getPages();
      const content = integrationPages
        .map((p) => `- [${p.data.title}](${p.url})${p.data.description ? `: ${p.data.description}` : ''}`)
        .join('\n');

      // Track resource read event
      captureMCPEvent('mcp_resource_read', {
        uri,
        latency_ms: Date.now() - startTime,
      });

      return {
        contents: [
          {
            uri,
            mimeType: 'text/markdown',
            text: `# Avalanche Integrations\n\n${content}`,
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
}

// JSON-RPC request schema
const jsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  method: z.string(),
  params: z.record(z.string(), z.unknown()).optional(),
});

// Process MCP JSON-RPC request
async function processRequest(request: z.infer<typeof jsonRpcRequestSchema>) {
  const { method, params, id } = request;

  try {
    let result: unknown;

    switch (method) {
      case 'initialize': {
        // Extract client info from params (per MCP spec)
        const clientInfo = params?.clientInfo as { name?: string; version?: string } | undefined;

        // Track client connection
        captureMCPEvent('mcp_initialize', {
          client_name: clientInfo?.name || 'unknown',
          client_version: clientInfo?.version || 'unknown',
          protocol_version: SERVER_INFO.protocolVersion,
        });

        result = {
          protocolVersion: SERVER_INFO.protocolVersion,
          capabilities: {
            tools: {},
            resources: {},
          },
          serverInfo: {
            name: SERVER_INFO.name,
            version: SERVER_INFO.version,
          },
        };
        break;
      }

      case 'tools/list':
        result = { tools: TOOLS };
        break;

      case 'tools/call':
        if (!params || typeof params.name !== 'string') {
          throw new Error('Invalid tool call: missing name');
        }
        result = await handleToolCall(
          params.name,
          (params.arguments as Record<string, unknown>) || {}
        );
        break;

      case 'resources/list':
        result = { resources: RESOURCES };
        break;

      case 'resources/read':
        if (!params || typeof params.uri !== 'string') {
          throw new Error('Invalid resource read: missing uri');
        }
        result = await handleResourceRead(params.uri);
        break;

      case 'ping':
        result = {};
        break;

      default:
        throw new Error(`Unknown method: ${method}`);
    }

    return {
      jsonrpc: '2.0',
      id,
      result,
    };
  } catch (error) {
    // Track error event (sanitized to avoid leaking sensitive info)
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
        message: error instanceof Error ? error.message : 'Internal error',
      },
    };
  }
}

// GET endpoint - returns server info and capabilities
export async function GET(request: NextRequest) {
  const corsHeaders = getCORSHeaders(request);

  return NextResponse.json(
    {
      name: SERVER_INFO.name,
      version: SERVER_INFO.version,
      protocolVersion: SERVER_INFO.protocolVersion,
      description: 'MCP server for Avalanche documentation',
      tools: TOOLS,
      resources: RESOURCES,
      endpoints: {
        rpc: '/api/mcp',
        docs: 'https://build.avax.network',
      },
    },
    { headers: corsHeaders }
  );
}

// OPTIONS endpoint - CORS preflight
export async function OPTIONS(request: NextRequest) {
  const corsHeaders = getCORSHeaders(request);

  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders,
      'Access-Control-Max-Age': '86400', // 24 hours
    },
  });
}

// Helper to create SSE response
function createSSEResponse(data: unknown, eventId?: string): Response {
  const encoder = new TextEncoder();
  let sseMessage = '';

  if (eventId) {
    sseMessage += `id: ${eventId}\n`;
  }
  sseMessage += `data: ${JSON.stringify(data)}\n\n`;

  return new Response(encoder.encode(sseMessage), {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}

// Helper to check if client wants SSE
function wantsSSE(request: Request): boolean {
  const accept = request.headers.get('accept') || '';
  return accept.includes('text/event-stream');
}

// POST endpoint - handles MCP JSON-RPC requests with Streamable HTTP support
export async function POST(request: NextRequest) {
  // Validate origin for CORS
  if (!validateOrigin(request)) {
    const corsHeaders = getCORSHeaders(request);
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32000,
          message: 'Origin not allowed'
        }
      },
      {
        status: 403,
        headers: corsHeaders,
      }
    );
  }

  // Check rate limit
  const rateLimitResponse = await checkMCPRateLimit(request);
  if (rateLimitResponse) {
    // Add CORS headers to rate limit response
    const corsHeaders = getCORSHeaders(request);
    const headers = new Headers(rateLimitResponse.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });

    return new NextResponse(rateLimitResponse.body, {
      status: rateLimitResponse.status,
      headers,
    });
  }

  try {
    const body = await request.json();
    const useSSE = wantsSSE(request);
    const corsHeaders = getCORSHeaders(request);
    const rateLimitHeaders = await getRateLimitHeaders(request);

    // Handle batch requests
    if (Array.isArray(body)) {
      const results = await Promise.all(
        body.map(async (req) => {
          const parsed = jsonRpcRequestSchema.safeParse(req);
          if (!parsed.success) {
            return {
              jsonrpc: '2.0',
              id: req.id ?? null,
              error: {
                code: -32600,
                message: 'Invalid request',
              },
            };
          }
          return processRequest(parsed.data);
        })
      );

      if (useSSE) {
        const response = createSSEResponse(results);
        Object.entries({ ...corsHeaders, ...rateLimitHeaders }).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        return response;
      }
      return NextResponse.json(results, { headers: { ...corsHeaders, ...rateLimitHeaders } });
    }

    // Handle single request
    const parsed = jsonRpcRequestSchema.safeParse(body);
    if (!parsed.success) {
      const errorResponse = {
        jsonrpc: '2.0',
        id: body.id ?? null,
        error: {
          code: -32600,
          message: 'Invalid request',
        },
      };

      if (useSSE) {
        const response = createSSEResponse(errorResponse);
        Object.entries({ ...corsHeaders, ...rateLimitHeaders }).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        return response;
      }
      return NextResponse.json(errorResponse, { status: 400, headers: { ...corsHeaders, ...rateLimitHeaders } });
    }

    const result = await processRequest(parsed.data);

    if (useSSE) {
      // Generate event ID for resumability
      const eventId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const response = createSSEResponse(result, eventId);
      Object.entries({ ...corsHeaders, ...rateLimitHeaders }).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }

    return NextResponse.json(result, { headers: { ...corsHeaders, ...rateLimitHeaders } });
  } catch (error) {
    console.error('MCP error:', error);
    const errorResponse = {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: 'Parse error',
      },
    };

    const corsHeaders = getCORSHeaders(request);
    const rateLimitHeaders = await getRateLimitHeaders(request);

    if (wantsSSE(request)) {
      const response = createSSEResponse(errorResponse);
      Object.entries({ ...corsHeaders, ...rateLimitHeaders }).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      return response;
    }
    return NextResponse.json(errorResponse, { status: 400, headers: { ...corsHeaders, ...rateLimitHeaders } });
  }
}
