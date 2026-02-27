import { documentation, academy, integration, blog } from '@/lib/source';
import { searchDocs, getPageContent } from '@/lib/mcp-server';
import { captureMCPEvent, truncateForTracking } from '../analytics';
import type { ToolDomain, ToolResult } from '../types';

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
  if (!allowedPrefixes.some((prefix) => url.startsWith(prefix))) {
    return {
      valid: false,
      error: `URL must start with one of: ${allowedPrefixes.join(', ')}`,
    };
  }

  return { valid: true };
}

export const docsTools: ToolDomain = {
  tools: [
    {
      name: 'docs_search',
      description:
        'Search across Avalanche documentation, academy courses, integrations, and blog posts',
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
    },
    {
      name: 'docs_list_sections',
      description: 'List available documentation sections and their page counts',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  ],

  handlers: {
    docs_search: async (args): Promise<ToolResult> => {
      const startTime = Date.now();

      const query = typeof args.query === 'string' ? args.query : '';
      const source = typeof args.source === 'string' ? args.source : undefined;
      const limit = typeof args.limit === 'number' ? args.limit : undefined;

      if (!query) {
        return {
          content: [{ type: 'text', text: 'Error: query parameter is required' }],
          isError: true,
        };
      }

      const results = searchDocs(query, { source, limit });
      const latencyMs = Date.now() - startTime;

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
    },

    docs_fetch: async (args): Promise<ToolResult> => {
      const startTime = Date.now();

      const url = args.url as string;

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
  },
};
