import { documentation, academy, integration, blog } from '@/lib/source';

// Revalidate hourly so new pages appear in the index without a redeploy.
export const revalidate = 3600;

type Source =
  | typeof documentation
  | typeof academy
  | typeof integration
  | typeof blog;

// Keep the whole document comfortably under the Agent Score 50K size cap.
// NOTE: the site has ~1,000 pages; listing them all is ~97K chars, which would
// fail `llms-txt-size`. The 50K cap and the 80% `llms-txt-coverage` target are
// mutually exclusive at this scale, so we index as many pages as fit (relative
// `.md` links, no per-page descriptions) and rely on sitemap.xml + universal
// `.md` support for full discovery.
const TARGET_TOTAL = 48000;

function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Build a "## Heading" block of relative `.md` links, consuming at most
// `budget` characters. Returns '' if nothing fits.
function sectionBlock(heading: string, source: Source, budget: number): string {
  const lines = source
    .getPages()
    .map((p) => `- [${p.data.title || 'Untitled'}](${p.url}.md)`);

  let body = '';
  for (const line of lines) {
    const next = `${line}\n`;
    if (body.length + next.length > budget) break;
    body += next;
  }
  return body ? `\n## ${heading}\n\n${body}` : '';
}

export async function GET() {
  const head = `# Avalanche Builder Hub

> Build your fast and interoperable Layer 1 blockchain with Avalanche. The Builder Hub provides comprehensive documentation, interactive tutorials, and developer tools.

Avalanche is a high-performance blockchain platform for decentralized applications and interoperable blockchains. Append \`.md\` to any URL below for its raw markdown, load [/llms-full.txt](/llms-full.txt) for the complete content in one file, or see [/sitemap.xml](/sitemap.xml) for the full page list.
`;

  const tail = `
## External Resources

- [GitHub](https://github.com/ava-labs): Official Avalanche Labs repositories
- [Discord](https://discord.gg/avalanche): Developer community
- [Explorer](https://subnets.avax.network): Avalanche network explorer
`;

  let remaining = TARGET_TOTAL - head.length - tail.length;
  let body = '';
  for (const [heading, source] of [
    ['Documentation', documentation],
    ['Academy', academy],
    ['Integrations', integration],
    ['Blog', blog],
  ] as Array<[string, Source]>) {
    const block = sectionBlock(heading, source, remaining);
    body += block;
    remaining -= block.length;
  }

  const content = head + body + tail;

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
