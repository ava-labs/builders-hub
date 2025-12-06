import { NextResponse } from 'next/server';
import { z } from 'zod';
import { documentation, academy, integration, blog } from '@/lib/source';
import { getLLMText } from '@/lib/llm-utils';

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
  switch (name) {
    case 'avalanche_docs_search': {
      const query = args.query as string;
      const source = args.source as string | undefined;
      const limit = args.limit as number | undefined;

      const results = searchDocs(query, { source, limit });

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
      const normalizedUrl = url.startsWith('/') ? url : `/${url}`;

      const content = await getPageContent(normalizedUrl);

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
  switch (uri) {
    case 'docs://index': {
      const docPages = documentation.getPages();
      const content = docPages
        .map((p) => `- [${p.data.title}](${p.url})${p.data.description ? `: ${p.data.description}` : ''}`)
        .join('\n');
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
      case 'initialize':
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
export async function GET() {
  return NextResponse.json({
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
  });
}

// POST endpoint - handles MCP JSON-RPC requests
export async function POST(request: Request) {
  try {
    const body = await request.json();

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
      return NextResponse.json(results);
    }

    // Handle single request
    const parsed = jsonRpcRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          id: body.id ?? null,
          error: {
            code: -32600,
            message: 'Invalid request',
          },
        },
        { status: 400 }
      );
    }

    const result = await processRequest(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error('MCP error:', error);
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error',
        },
      },
      { status: 400 }
    );
  }
}
