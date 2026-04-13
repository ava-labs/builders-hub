import { NextResponse } from 'next/server';
import { withApi, BadRequestError, NotFoundError } from '@/lib/api';
import { documentation, academy, integration, blog } from '@/lib/source';
import { getLLMText } from '@/lib/llm-utils';

const markdownHeaders = {
  'Content-Type': 'text/markdown; charset=utf-8',
  'Cache-Control': 'public, max-age=3600, s-maxage=3600',
  Vary: 'Accept',
};

type Source = typeof documentation | typeof academy | typeof integration | typeof blog;

const sourceMap: Record<string, { source: Source; label: string }> = {
  docs: { source: documentation, label: 'Documentation' },
  academy: { source: academy, label: 'Academy' },
  blog: { source: blog, label: 'Blog' },
  integrations: { source: integration, label: 'Integrations' },
};

function buildSectionIndex(source: Source, label: string): string {
  const pages = source.getPages();
  const sections: Record<string, Array<{ url: string; title: string }>> = {};

  for (const page of pages) {
    const parts = page.url.split('/').filter(Boolean);
    const section = parts.length >= 2 ? parts[1] : 'general';
    if (!sections[section]) sections[section] = [];
    sections[section].push({ url: page.url, title: page.data.title || 'Untitled' });
  }

  let content = `# ${label}\n\n`;
  for (const [section, sectionPages] of Object.entries(sections)) {
    const heading = section
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    content += `## ${heading}\n`;
    for (const p of sectionPages.slice(0, 10)) {
      content += `- [${p.title}](${p.url})\n`;
    }
    content += '\n';
  }

  return content;
}

/** Reject path traversal patterns: "..", "//", null bytes */
function validateSlugSegments(segments: string[]): void {
  for (const segment of segments) {
    if (segment === '..' || segment === '.' || segment.includes('\0') || segment === '') {
      throw new BadRequestError('Invalid path segment');
    }
  }
  const joined = segments.join('/');
  if (joined.includes('//')) {
    throw new BadRequestError('Invalid path: double slashes not allowed');
  }
}

export const GET = withApi(async (_req, { params }) => {
  const { slug } = params as unknown as { slug: string[] };

  if (!slug || slug.length === 0) {
    throw new BadRequestError('Path required');
  }

  validateSlugSegments(slug);

  const [contentType, ...restPath] = slug;
  const entry = sourceMap[contentType];

  if (!entry) {
    throw new BadRequestError('Invalid content type');
  }

  // Section root request (e.g., /api/raw/docs) -- return a synthesized index
  if (restPath.length === 0) {
    const content = buildSectionIndex(entry.source, entry.label);
    return new NextResponse(content, { status: 200, headers: markdownHeaders });
  }

  const page = entry.source.getPage(restPath);

  if (!page) {
    throw new NotFoundError('Page');
  }

  const content = await getLLMText(page);
  return new NextResponse(content, { status: 200, headers: markdownHeaders });
});
