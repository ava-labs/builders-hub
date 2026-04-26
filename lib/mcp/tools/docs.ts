import { documentation, academy, integration, blog } from '@/lib/source';
import { searchDocs, getPageContent } from '@/lib/mcp-server';
import {
  ACP_STATUSES,
  findAcpByNumber,
  listAcps,
  type AcpEntry,
} from '@/lib/mcp/acps';
import { captureMCPEvent, truncateForTracking } from '../analytics';
import type { MCPTool, ToolDomain, ToolResult } from '../types';

const SOURCE_VALUES = ['docs', 'academy', 'integrations', 'blog'] as const;
const CLI_VALUES = ['avalanche-cli', 'platform-cli', 'tmpnet', 'all'] as const;
const RPC_CHAIN_VALUES = ['p-chain', 'c-chain', 'x-chain', 'subnet-evm', 'other', 'all'] as const;
const ACP_TRACKS = ['Standards', 'Best Practices', 'Meta', 'Subnet'] as const;

const CLI_PATH_PREFIXES: Record<(typeof CLI_VALUES)[number], string[]> = {
  'avalanche-cli': ['/docs/tooling/avalanche-cli'],
  'platform-cli': ['/docs/tooling/platform-cli'],
  tmpnet: ['/docs/tooling/tmpnet'],
  all: ['/docs/tooling/avalanche-cli', '/docs/tooling/platform-cli', '/docs/tooling/tmpnet'],
};

const RPC_PATH_PREFIXES: Record<(typeof RPC_CHAIN_VALUES)[number], string[]> = {
  'p-chain': ['/docs/rpcs/p-chain'],
  'c-chain': ['/docs/rpcs/c-chain'],
  'x-chain': ['/docs/rpcs/x-chain'],
  'subnet-evm': ['/docs/rpcs/subnet-evm'],
  other: ['/docs/rpcs/other'],
  all: ['/docs/rpcs'],
};

function getStringArg(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  return typeof value === 'string' ? value.trim() : '';
}

function getLimit(args: Record<string, unknown>, defaultLimit = 10): number {
  const rawLimit = args.limit;
  const limit = typeof rawLimit === 'number' ? rawLimit : defaultLimit;
  return Math.min(Math.max(Math.floor(limit), 1), 50);
}

function formatSearchResults(
  query: string,
  results: Awaited<ReturnType<typeof searchDocs>>,
  emptyLabel = 'results'
): string {
  if (results.length === 0) {
    return `No ${emptyLabel} found for "${query}"`;
  }

  const formattedResults = results
    .map((result, index) => {
      const citation = `https://build.avax.network${result.url}`;
      const chunk = result.chunkIndex !== undefined ? `, chunk ${result.chunkIndex + 1}` : '';
      const description = result.description ? `\n   ${result.description}` : '';
      const excerpt = result.excerpt ? `\n   Match: ${result.excerpt}` : '';

      return `${index + 1}. [${result.title}](${citation}) (${result.source}${chunk})${description}${excerpt}`;
    })
    .join('\n\n');

  return `Found ${results.length} source-grounded matches for "${query}":\n\n${formattedResults}`;
}

function prependAliasNotice(result: ToolResult, canonicalName: string): ToolResult {
  const notice = `Note: this avalanche_* tool name is kept for compatibility. Prefer \`${canonicalName}\` for new clients.\n\n`;
  return {
    ...result,
    content: result.content.map((item, index) =>
      index === 0 && item.type === 'text'
        ? { ...item, text: `${notice}${item.text}` }
        : item
    ),
  };
}

const docsSearchTool: MCPTool = {
  name: 'docs_search',
  description:
    'Search body-level chunks across Avalanche documentation, academy courses, integrations, and blog posts. Returns source citations and matching excerpts.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query',
      },
      source: {
        type: 'string',
        enum: SOURCE_VALUES,
        description: 'Filter by documentation source (optional)',
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 50,
        description: 'Maximum number of chunk results (default: 10)',
      },
    },
    required: ['query'],
  },
};

const docsFetchTool: MCPTool = {
  name: 'docs_fetch',
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
};

const docsListSectionsTool: MCPTool = {
  name: 'docs_list_sections',
  description: 'List available documentation sections and their page counts',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

const cliLookupTool: MCPTool = {
  name: 'cli_lookup_command',
  description:
    'Look up Avalanche CLI, Platform CLI, and tmpnet command guidance in the docs. Returns cited command references and task docs.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Command, flag, or task to look up',
      },
      cli: {
        type: 'string',
        enum: CLI_VALUES,
        description: 'CLI surface to search. Defaults to all.',
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 20,
        description: 'Maximum number of results (default: 8)',
      },
    },
    required: ['query'],
  },
};

const rpcLookupTool: MCPTool = {
  name: 'rpc_lookup_method',
  description:
    'Look up Avalanche RPC methods and API guides across C-Chain, P-Chain, X-Chain, Subnet-EVM, and node RPC docs.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'RPC method, namespace, or task to look up',
      },
      chain: {
        type: 'string',
        enum: RPC_CHAIN_VALUES,
        description: 'RPC area to search. Defaults to all.',
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 20,
        description: 'Maximum number of results (default: 8)',
      },
    },
    required: ['query'],
  },
};

const acpLookupTool: MCPTool = {
  name: 'acp_lookup',
  description:
    'Look up Avalanche Community Proposals (ACPs) by number, title, or topic. When a number is provided the structured ACP record is returned (title, status, track, authors, cross-references).',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'ACP title, topic, or keyword',
      },
      number: {
        type: 'number',
        description: 'ACP number, if known',
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 20,
        description: 'Maximum number of results (default: 8)',
      },
    },
    required: [],
  },
};

const acpListTool: MCPTool = {
  name: 'acp_list',
  description:
    'List Avalanche Community Proposals with structured fields, optionally filtered by status (Activated, Implementable, Proposed, Stale, Withdrawn) or track (Standards, Best Practices, Meta, Subnet).',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: [...ACP_STATUSES, 'Unknown'],
        description: 'Filter by ACP status (case-insensitive)',
      },
      track: {
        type: 'string',
        enum: ACP_TRACKS,
        description: 'Filter by ACP track. Matches Standards, Best Practices, Meta, or Subnet.',
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 100,
        description: 'Maximum number of ACPs to return (default: 50)',
      },
    },
    required: [],
  },
};

function validateFetchUrl(url: string): { valid: boolean; error?: string } {
  if (typeof url !== 'string' || !url.startsWith('/')) {
    return { valid: false, error: 'URL must start with /' };
  }

  // Decode once so a percent-encoded `..` doesn't slip past the literal check.
  let decoded = url;
  try {
    decoded = decodeURIComponent(url);
  } catch {
    return { valid: false, error: 'URL contains invalid percent-encoded characters' };
  }

  if (decoded.includes('://') || decoded.includes('..') || decoded.includes('\\')) {
    return { valid: false, error: 'URL must be an internal path without "..", "\\", or protocols' };
  }

  const allowedPrefixes = ['/docs/', '/academy/', '/integrations/', '/blog/'];
  if (!allowedPrefixes.some((prefix) => decoded.startsWith(prefix))) {
    return {
      valid: false,
      error: `URL must start with one of: ${allowedPrefixes.join(', ')}`,
    };
  }

  return { valid: true };
}

function formatAcpEntry(entry: AcpEntry): string {
  const lines = [
    `**ACP-${entry.number}: ${entry.title}**`,
    `Status: ${entry.status}${entry.rawStatus && entry.rawStatus !== entry.status ? ` (${entry.rawStatus})` : ''}`,
    `Track: ${entry.tracks.join(', ') || 'Unspecified'}`,
  ];
  if (entry.authors.length > 0) {
    lines.push(`Authors: ${entry.authors.join(', ')}`);
  }
  if (entry.replaces && entry.replaces.length > 0) {
    lines.push(`Replaces: ${entry.replaces.map((n) => `ACP-${n}`).join(', ')}`);
  }
  if (entry.supersededBy && entry.supersededBy.length > 0) {
    lines.push(`Superseded by: ${entry.supersededBy.map((n) => `ACP-${n}`).join(', ')}`);
  }
  if (entry.updates && entry.updates.length > 0) {
    lines.push(`Updates: ${entry.updates.map((n) => `ACP-${n}`).join(', ')}`);
  }
  if (entry.updatedBy && entry.updatedBy.length > 0) {
    lines.push(`Updated by: ${entry.updatedBy.map((n) => `ACP-${n}`).join(', ')}`);
  }
  lines.push(`Source: https://build.avax.network${entry.url}`);
  if (entry.discussionUrl) lines.push(`Discussion: ${entry.discussionUrl}`);
  return lines.join('\n');
}

export const docsTools: ToolDomain = {
  tools: [
    docsSearchTool,
    docsFetchTool,
    docsListSectionsTool,
    cliLookupTool,
    rpcLookupTool,
    acpLookupTool,
    acpListTool,
    {
      ...docsSearchTool,
      name: 'avalanche_docs_search',
      description: 'Compatibility alias for docs_search. Prefer docs_search for new clients.',
    },
    {
      ...docsFetchTool,
      name: 'avalanche_docs_fetch',
      description: 'Compatibility alias for docs_fetch. Prefer docs_fetch for new clients.',
    },
    {
      ...docsListSectionsTool,
      name: 'avalanche_docs_list_sections',
      description:
        'Compatibility alias for docs_list_sections. Prefer docs_list_sections for new clients.',
    },
  ],

  handlers: {
    docs_search: async (args): Promise<ToolResult> => {
      const startTime = Date.now();

      const query = getStringArg(args, 'query');
      const source = SOURCE_VALUES.includes(args.source as (typeof SOURCE_VALUES)[number])
        ? (args.source as string)
        : undefined;
      const limit = getLimit(args);

      if (!query) {
        return {
          content: [{ type: 'text', text: 'Error: query parameter is required' }],
          isError: true,
        };
      }

      const results = await searchDocs(query, { source, limit });
      const latencyMs = Date.now() - startTime;

      captureMCPEvent('mcp_search', {
        query: query ? truncateForTracking(query) : '',
        source_filter: source || 'all',
        result_count: results.length,
        latency_ms: latencyMs,
      });

      return {
        content: [
          {
            type: 'text',
            text: formatSearchResults(query, results),
          },
        ],
      };
    },

    docs_fetch: async (args): Promise<ToolResult> => {
      const startTime = Date.now();

      const url = getStringArg(args, 'url');

      if (!url) {
        return {
          content: [{ type: 'text', text: 'Error: url parameter is required' }],
          isError: true,
        };
      }

      const validation = validateFetchUrl(url);
      if (!validation.valid) {
        return {
          content: [{ type: 'text', text: `Invalid URL: ${validation.error}` }],
          isError: true,
        };
      }

      const normalizedUrl = url.startsWith('/') ? url : `/${url}`;

      const content = await getPageContent(normalizedUrl);
      const latencyMs = Date.now() - startTime;

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
    },

    docs_list_sections: async (_args): Promise<ToolResult> => {
      const startTime = Date.now();

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

      captureMCPEvent('mcp_list_sections', {
        latency_ms: latencyMs,
      });

      return {
        content: [{ type: 'text', text }],
      };
    },

    cli_lookup_command: async (args): Promise<ToolResult> => {
      const query = getStringArg(args, 'query');
      const cli = CLI_VALUES.includes(args.cli as (typeof CLI_VALUES)[number])
        ? (args.cli as (typeof CLI_VALUES)[number])
        : 'all';

      if (!query) {
        return {
          content: [{ type: 'text', text: 'Error: query parameter is required' }],
          isError: true,
        };
      }

      const results = await searchDocs(query, {
        source: 'docs',
        limit: getLimit(args, 8),
        pathPrefixes: CLI_PATH_PREFIXES[cli],
      });

      return {
        content: [{ type: 'text', text: formatSearchResults(query, results, 'CLI results') }],
      };
    },

    rpc_lookup_method: async (args): Promise<ToolResult> => {
      const query = getStringArg(args, 'query');
      const chain = RPC_CHAIN_VALUES.includes(args.chain as (typeof RPC_CHAIN_VALUES)[number])
        ? (args.chain as (typeof RPC_CHAIN_VALUES)[number])
        : 'all';

      if (!query) {
        return {
          content: [{ type: 'text', text: 'Error: query parameter is required' }],
          isError: true,
        };
      }

      const results = await searchDocs(query, {
        source: 'docs',
        limit: getLimit(args, 8),
        pathPrefixes: RPC_PATH_PREFIXES[chain],
      });

      return {
        content: [{ type: 'text', text: formatSearchResults(query, results, 'RPC results') }],
      };
    },

    acp_lookup: async (args): Promise<ToolResult> => {
      const query = getStringArg(args, 'query');
      const numericInput =
        typeof args.number === 'number'
          ? Math.floor(args.number)
          : Number.parseInt(getStringArg(args, 'number'), 10);

      const hasNumber = Number.isFinite(numericInput) && numericInput > 0;
      const numberLabel = hasNumber ? String(numericInput) : '';
      const searchQuery = [numberLabel ? `ACP ${numberLabel}` : '', query]
        .filter(Boolean)
        .join(' ')
        .trim();

      if (!searchQuery) {
        return {
          content: [{ type: 'text', text: 'Error: query or number parameter is required' }],
          isError: true,
        };
      }

      const sections: string[] = [];
      let structuredEntry: AcpEntry | undefined;

      if (hasNumber) {
        try {
          structuredEntry = await findAcpByNumber(numericInput);
          if (structuredEntry) {
            sections.push(formatAcpEntry(structuredEntry));
          } else {
            sections.push(`No structured ACP-${numericInput} record found in the registry.`);
          }
        } catch (error) {
          console.error('[acp_lookup] structured lookup failed', error);
        }
      }

      const results = await searchDocs(searchQuery, {
        source: 'docs',
        limit: getLimit(args, 8),
        pathPrefixes: ['/docs/acps'],
      });

      const dedupedResults = structuredEntry
        ? results.filter((result) => result.url !== structuredEntry!.url)
        : results;

      if (dedupedResults.length > 0 || !structuredEntry) {
        sections.push(formatSearchResults(searchQuery, dedupedResults, 'ACP results'));
      }

      return {
        content: [{ type: 'text', text: sections.join('\n\n') }],
      };
    },

    acp_list: async (args): Promise<ToolResult> => {
      const status = getStringArg(args, 'status') || undefined;
      const track = getStringArg(args, 'track') || undefined;
      // Use a 100-cap default of 50 — separate from the search-result getLimit (which caps at 50).
      const rawLimit = typeof args.limit === 'number' ? args.limit : 50;
      const limit = Math.min(Math.max(Math.floor(rawLimit), 1), 100);

      try {
        const entries = await listAcps({ status, track, limit });
        if (entries.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No ACPs match the requested filters (status=${status || 'any'}, track=${track || 'any'}).`,
              },
            ],
          };
        }

        const text = [
          `Found ${entries.length} ACPs (status=${status || 'any'}, track=${track || 'any'}):`,
          '',
          ...entries.map(
            (entry) =>
              `- ACP-${entry.number} | ${entry.status} | ${entry.tracks.join('/') || 'No track'} - ${entry.title} (https://build.avax.network${entry.url})`
          ),
        ].join('\n');

        return { content: [{ type: 'text', text }] };
      } catch (error) {
        console.error('[acp_list] registry load failed', error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: failed to load ACP registry - ${error instanceof Error ? error.message : 'unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    },

    avalanche_docs_search: async (args): Promise<ToolResult> => {
      const result = await docsTools.handlers.docs_search(args);
      return prependAliasNotice(result, 'docs_search');
    },

    avalanche_docs_fetch: async (args): Promise<ToolResult> => {
      const result = await docsTools.handlers.docs_fetch(args);
      return prependAliasNotice(result, 'docs_fetch');
    },

    avalanche_docs_list_sections: async (args): Promise<ToolResult> => {
      const result = await docsTools.handlers.docs_list_sections(args);
      return prependAliasNotice(result, 'docs_list_sections');
    },
  },
};
