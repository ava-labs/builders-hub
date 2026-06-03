import { documentation, academy, blog } from '@/lib/source';

// Revalidate hourly so new pages appear in the index without a redeploy.
export const revalidate = 3600;

type Source = typeof documentation | typeof academy | typeof blog;

// Curated agent-discovery scope. We deliberately DO NOT index everything:
//   - Docs + Blog: all of it.
//   - Academy: the Avalanche L1 and Entrepreneur academies in full, plus only
//     the x402 course from the Blockchain academy. The rest of the Blockchain
//     academy (fundamentals, solidity, etc.) and ALL integrations (third-party
//     partner listings) are intentionally excluded — they aren't the content we
//     want agents surfacing as "Avalanche documentation".
// Relative `.md` links + no per-page descriptions keep the file small.
function academyIncluded(url: string): boolean {
  return (
    url.startsWith('/academy/avalanche-l1/') ||
    url.startsWith('/academy/entrepreneur/') ||
    url.startsWith('/academy/blockchain/x402-payment-infrastructure/')
  );
}

function sectionOf(url: string): string {
  const parts = url.split('/').filter(Boolean);
  return parts.length >= 2 ? parts[1] : 'general';
}

function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// "## Heading" + relative `.md` links, grouped by URL section.
function block(heading: string, source: Source, filter?: (url: string) => boolean): string {
  const groups: Record<string, Array<{ url: string; title: string }>> = {};
  for (const page of source.getPages()) {
    if (filter && !filter(page.url)) continue;
    const section = sectionOf(page.url);
    (groups[section] ??= []).push({ url: page.url, title: page.data.title || 'Untitled' });
  }

  let out = `\n## ${heading}\n`;
  for (const [section, pages] of Object.entries(groups)) {
    out += `\n### ${titleCase(section)}\n`;
    for (const p of pages) out += `- [${p.title}](${p.url}.md)\n`;
  }
  return out;
}

export async function GET() {
  const content =
    `# Avalanche Builder Hub

> Build your fast and interoperable Layer 1 blockchain with Avalanche. The Builder Hub provides comprehensive documentation, interactive tutorials, and developer tools.

Avalanche is a high-performance blockchain platform for decentralized applications and interoperable blockchains. Append \`.md\` to any URL below for its raw markdown, or load [/llms-full.txt](/llms-full.txt) for the complete content in one file.
` +
    block('Documentation', documentation) +
    block('Academy', academy, academyIncluded) +
    block('Blog', blog) +
    `
## External Resources

- [GitHub](https://github.com/ava-labs): Official Avalanche Labs repositories
- [Discord](https://discord.gg/avalanche): Developer community
- [Explorer](https://subnets.avax.network): Avalanche network explorer
`;

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
