/**
 * MCP resource domain for Avalanche documentation.
 *
 * Provides three resources:
 *   docs://index        — list of all documentation pages
 *   academy://index     — list of all academy course pages
 *   integrations://index — list of all integration pages
 */

import { documentation, academy, integration } from '@/lib/source';
import type { ResourceDomain } from '../types';

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
  ],

  handler: async (uri: string) => {
    switch (uri) {
      case 'docs://index': {
        const pages = documentation.getPages();
        const content = pages
          .map(
            (p) =>
              `- [${p.data.title}](${p.url})${p.data.description ? `: ${p.data.description}` : ''}`
          )
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
        const pages = academy.getPages();
        const content = pages
          .map(
            (p) =>
              `- [${p.data.title}](${p.url})${p.data.description ? `: ${p.data.description}` : ''}`
          )
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
        const pages = integration.getPages();
        const content = pages
          .map(
            (p) =>
              `- [${p.data.title}](${p.url})${p.data.description ? `: ${p.data.description}` : ''}`
          )
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
  },
};
