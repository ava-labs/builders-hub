import { documentation, academy, integration, blog } from '@/lib/source';

// Helper to group pages by top-level section
function groupPagesBySection(pages: Array<{ url: string; data: { title: string; description?: string } }>) {
  const sections: Record<string, Array<{ url: string; title: string; description?: string }>> = {};

  for (const page of pages) {
    // Extract top-level section from URL (e.g., /docs/primary-network/... -> primary-network)
    const parts = page.url.split('/').filter(Boolean);
    if (parts.length < 2) continue;

    const section = parts[1]; // First part after /docs/, /academy/, etc.

    if (!sections[section]) {
      sections[section] = [];
    }

    sections[section].push({
      url: page.url,
      title: page.data.title || 'Untitled',
      description: page.data.description,
    });
  }

  return sections;
}

// Format section name for display (e.g., "primary-network" -> "Primary Network")
function formatSectionName(section: string): string {
  return section
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export async function GET() {
  const baseUrl = 'https://build.avax.network';

  // Get all pages from each source
  const docPages = documentation.getPages();
  const academyPages = academy.getPages();
  const integrationPages = integration.getPages();
  const blogPages = blog.getPages();

  // Build the llms.txt content following the standard format
  let content = `# Avalanche Builder Hub

> Build your fast and interoperable Layer 1 blockchain with Avalanche. The Builder Hub provides comprehensive documentation, interactive tutorials, and developer tools.

Avalanche is a high-performance blockchain platform for decentralized applications, new financial primitives, and interoperable blockchains. The Builder Hub helps developers create custom Layer 1 blockchains (Avalanche L1s), build cross-chain applications using Interchain Messaging (ICM), and leverage the Avalanche ecosystem.

## Raw Markdown Access

All documentation links below end with \`.md\` and return raw markdown content for easy AI consumption. You can append \`.md\` to any documentation, academy, blog, or integration URL on this site to get the raw markdown source.

## Full Documentation

- [Full Documentation (llms-full.txt)](${baseUrl}/llms-full.txt): Complete documentation content for AI context loading

## Documentation

Core technical documentation for building on Avalanche:

`;

  // Group documentation pages by section
  const docSections = groupPagesBySection(docPages);

  // Define priority sections for docs (order matters)
  const docPrioritySections = [
    'primary-network',
    'avalanche-l1s',
    'cross-chain',
    'nodes',
    'virtual-machines',
    'dapps',
  ];

  // Add priority documentation sections first
  for (const section of docPrioritySections) {
    if (docSections[section]) {
      content += `### ${formatSectionName(section)}\n`;
      // Show top 5 pages per section to keep index manageable
      const topPages = docSections[section].slice(0, 5);
      for (const page of topPages) {
        const desc = page.description ? `: ${page.description}` : '';
        content += `- [${page.title}](${baseUrl}${page.url}.md)${desc}\n`;
      }
      content += '\n';
      delete docSections[section];
    }
  }

  content += `## Academy

Structured learning paths and interactive tutorials:

`;

  // Group academy pages by course
  const academySections = groupPagesBySection(academyPages);

  // Define priority academy courses
  const academyPrioritySections = [
    'blockchain-fundamentals',
    'avalanche-l1',
    'interchain-messaging',
    'interchain-token-transfer',
    'customizing-evm',
  ];

  for (const section of academyPrioritySections) {
    if (academySections[section]) {
      content += `### ${formatSectionName(section)}\n`;
      const topPages = academySections[section].slice(0, 3);
      for (const page of topPages) {
        const desc = page.description ? `: ${page.description}` : '';
        content += `- [${page.title}](${baseUrl}${page.url}.md)${desc}\n`;
      }
      content += '\n';
      delete academySections[section];
    }
  }

  content += `## Integrations

Third-party tools and services for the Avalanche ecosystem:

- [All Integrations](${baseUrl}/integrations): Browse all integration partners and tools
`;

  // Add top integrations by category
  const topIntegrations = integrationPages.slice(0, 10);
  for (const page of topIntegrations) {
    const desc = page.data.description ? `: ${page.data.description}` : '';
    content += `- [${page.data.title}](${baseUrl}${page.url}.md)${desc}\n`;
  }

  content += `
## Blog

Latest announcements, tutorials, and ecosystem updates:

`;

  // Add recent blog posts
  const recentBlogs = blogPages.slice(0, 5);
  for (const page of recentBlogs) {
    const desc = page.data.description ? `: ${page.data.description}` : '';
    content += `- [${page.data.title}](${baseUrl}${page.url}.md)${desc}\n`;
  }

  content += `
## Console Tools

Interactive developer tools for building and managing Avalanche L1s:

- [Create L1](${baseUrl}/console/layer-1/create): Launch custom Layer 1 blockchains
- [Faucet](${baseUrl}/console/primary-network/faucet): Get testnet AVAX for development
- [ICM Setup](${baseUrl}/console/icm/setup): Configure Interchain Messaging
- [ICTT Setup](${baseUrl}/console/ictt/setup): Configure token bridges
- [Validator Management](${baseUrl}/console/layer-1/validator-set): Manage L1 validators

## Optional

Additional resources and reference documentation:

### API Reference
`;

  // Add API reference sections
  if (docSections['api-reference']) {
    const apiPages = docSections['api-reference'].slice(0, 5);
    for (const page of apiPages) {
      content += `- [${page.title}](${baseUrl}${page.url}.md)\n`;
    }
    delete docSections['api-reference'];
  }

  content += `
### RPC Methods
`;

  if (docSections['rpcs']) {
    const rpcPages = docSections['rpcs'].slice(0, 5);
    for (const page of rpcPages) {
      content += `- [${page.title}](${baseUrl}${page.url}.md)\n`;
    }
    delete docSections['rpcs'];
  }

  content += `
### Tooling & SDKs
`;

  if (docSections['tooling']) {
    const toolingPages = docSections['tooling'].slice(0, 5);
    for (const page of toolingPages) {
      content += `- [${page.title}](${baseUrl}${page.url}.md)\n`;
    }
    delete docSections['tooling'];
  }

  content += `
### Avalanche Community Proposals (ACPs)
`;

  if (docSections['acps']) {
    const acpPages = docSections['acps'].slice(0, 5);
    for (const page of acpPages) {
      content += `- [${page.title}](${baseUrl}${page.url}.md)\n`;
    }
  }

  content += `
## External Resources

- [GitHub](https://github.com/ava-labs): Official Avalanche Labs repositories
- [Discord](https://discord.gg/avalanche): Developer community
- [Forum](https://forum.avax.network): Technical discussions
- [Explorer](https://subnets.avax.network): Avalanche network explorer
`;

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
