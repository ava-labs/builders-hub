import { NextResponse, NextRequest } from 'next/server';
import { MCPServer } from '@/lib/mcp/server';
import { validateOrigin, getCORSHeaders } from '@/lib/mcp/cors';
import { checkMCPRateLimit, getRateLimitHeaders } from '@/lib/mcp-rate-limit';
import { docsTools, blockchainTools, githubTools, platformTools, infoTools } from '@/lib/mcp/tools';
import { docsResources } from '@/lib/mcp/resources';

// ---------------------------------------------------------------------------
// Singleton MCP server — registered once at module load
// ---------------------------------------------------------------------------

const server = new MCPServer({
  name: 'avalanche-mcp',
  version: '2.0.0',
  protocolVersion: '2024-11-05',
  description: 'Unified MCP server for Avalanche — docs, blockchain, GitHub, P-Chain, and Info API',
});

server.registerToolDomain(docsTools);
server.registerToolDomain(blockchainTools);
server.registerToolDomain(githubTools);
server.registerToolDomain(platformTools);
server.registerToolDomain(infoTools);
server.registerResourceDomain(docsResources);

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------

function wantsSSE(request: Request): boolean {
  return (request.headers.get('accept') || '').includes('text/event-stream');
}

function createSSEResponse(data: unknown, eventId?: string): Response {
  const encoder = new TextEncoder();
  let msg = '';
  if (eventId) msg += `id: ${eventId}\n`;
  msg += `data: ${JSON.stringify(data)}\n\n`;
  return new Response(encoder.encode(msg), {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}

// ---------------------------------------------------------------------------
// GET — server info + capabilities
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCORSHeaders(origin);
  return NextResponse.json(server.getServerInfo(), { headers: corsHeaders });
}

// ---------------------------------------------------------------------------
// OPTIONS — CORS preflight
// ---------------------------------------------------------------------------

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCORSHeaders(origin);
  return new Response(null, {
    status: 204,
    headers: { ...corsHeaders, 'Access-Control-Max-Age': '86400' },
  });
}

// ---------------------------------------------------------------------------
// POST — JSON-RPC 2.0 dispatcher
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');

  // CORS validation
  if (!validateOrigin(origin)) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Origin not allowed' } },
      { status: 403, headers: getCORSHeaders(origin) }
    );
  }

  // Rate limiting
  const rateLimitResponse = await checkMCPRateLimit(request);
  if (rateLimitResponse) {
    const corsHeaders = getCORSHeaders(origin);
    const headers = new Headers(rateLimitResponse.headers);
    Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
    return new NextResponse(rateLimitResponse.body, { status: rateLimitResponse.status, headers });
  }

  try {
    const body = await request.json();
    const useSSE = wantsSSE(request);
    const corsHeaders = getCORSHeaders(origin);
    const rateLimitHeaders = await getRateLimitHeaders(request);
    const allHeaders = { ...corsHeaders, ...rateLimitHeaders };

    const result = await server.handlePost(body);

    if (useSSE) {
      const eventId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const response = createSSEResponse(result, Array.isArray(result) ? undefined : eventId);
      Object.entries(allHeaders).forEach(([k, v]) => response.headers.set(k, v));
      return response;
    }

    return NextResponse.json(result, { headers: allHeaders });
  } catch {
    const errorResponse = { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } };
    const corsHeaders = getCORSHeaders(origin);
    const rateLimitHeaders = await getRateLimitHeaders(request);
    const allHeaders = { ...corsHeaders, ...rateLimitHeaders };

    if (wantsSSE(request)) {
      const response = createSSEResponse(errorResponse);
      Object.entries(allHeaders).forEach(([k, v]) => response.headers.set(k, v));
      return response;
    }
    return NextResponse.json(errorResponse, { status: 400, headers: allHeaders });
  }
}
