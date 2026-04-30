/**
 * MCP resource domain for Avalanche documentation.
 *
 * Provides structured indexes over Avalanche documentation surfaces.
 */

import { documentation, academy, integration, blog } from '@/lib/source';
import type { ResourceDomain } from '../types';

type IndexPage = {
  url: string;
  data: {
    title?: string;
    description?: string;
  };
};

type PageList = IndexPage[];

function toIndexPages(pages: unknown): PageList {
  return pages as PageList;
}

function formatPageIndex(title: string, pages: PageList): string {
  const content = pages
    .map(
      (page) =>
        `- [${page.data.title}](${page.url})${page.data.description ? `: ${page.data.description}` : ''}`
    )
    .join('\n');

  return `# ${title}\n\n${content}`;
}

function filterDocsByPrefix(prefix: string): PageList {
  return toIndexPages(documentation.getPages().filter((page) => page.url.startsWith(prefix)));
}

export const docsResources: ResourceDomain = {
  resources: [
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
    {
      uri: 'blog://index',
      name: 'Blog Index',
      description: 'Index of all Avalanche Builders Hub blog posts',
      mimeType: 'text/markdown',
    },
    {
      uri: 'rpcs://index',
      name: 'RPC Documentation Index',
      description: 'Index of Avalanche RPC method and API documentation',
      mimeType: 'text/markdown',
    },
    {
      uri: 'cli://index',
      name: 'CLI Documentation Index',
      description: 'Index of Avalanche CLI, Platform CLI, and tmpnet documentation',
      mimeType: 'text/markdown',
    },
    {
      uri: 'acps://index',
      name: 'ACP Index',
      description: 'Index of Avalanche Community Proposal documentation',
      mimeType: 'text/markdown',
    },
  ],

  handler: async (uri: string) => {
    switch (uri) {
      case 'docs://index': {
        const pages = toIndexPages(documentation.getPages());
        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text: formatPageIndex('Avalanche Documentation Index', pages),
            },
          ],
        };
      }

      case 'academy://index': {
        const pages = toIndexPages(academy.getPages());
        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text: formatPageIndex('Avalanche Academy Courses', pages),
            },
          ],
        };
      }

      case 'integrations://index': {
        const pages = toIndexPages(integration.getPages());
        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text: formatPageIndex('Avalanche Integrations', pages),
            },
          ],
        };
      }

      case 'blog://index': {
        const pages = toIndexPages(blog.getPages());
        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text: formatPageIndex('Avalanche Blog Posts', pages),
            },
          ],
        };
      }

      case 'rpcs://index': {
        const pages = filterDocsByPrefix('/docs/rpcs');
        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text: formatPageIndex('Avalanche RPC Documentation Index', pages),
            },
          ],
        };
      }

      case 'cli://index': {
        const pages = toIndexPages(
          documentation.getPages().filter(
            (page) =>
              page.url.startsWith('/docs/tooling/avalanche-cli') ||
              page.url.startsWith('/docs/tooling/platform-cli') ||
              page.url.startsWith('/docs/tooling/tmpnet')
          )
        );
        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text: formatPageIndex('Avalanche CLI Documentation Index', pages),
            },
          ],
        };
      }

      case 'acps://index': {
        const pages = filterDocsByPrefix('/docs/acps');
        return {
          contents: [
            {
              uri,
              mimeType: 'text/markdown',
              text: formatPageIndex('Avalanche Community Proposals', pages),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown resource: ${uri}`);
    }
  },
};
