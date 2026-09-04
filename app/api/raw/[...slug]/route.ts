import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/authSession';
import { hasPermission } from '@/lib/auth/rolePermissions';
import { documentation, academy, integration, blog } from '@/lib/source';
import { getLLMText } from '@/lib/llm-utils';

const markdownHeaders = {
  'Content-Type': 'text/markdown; charset=utf-8',
  'Cache-Control': 'public, max-age=3600, s-maxage=3600',
  'Vary': 'Accept',
};

/**
 * Gated content must never carry a `public` cache directive: a shared cache
 * could store one authorized response and hand it to anyone requesting the same
 * URL, which would defeat the per-request permission check below.
 */
const privateMarkdownHeaders = {
  'Content-Type': 'text/markdown; charset=utf-8',
  'Cache-Control': 'private, no-store',
  'Vary': 'Accept, Cookie',
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
    const heading = section.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    content += `## ${heading}\n`;
    for (const p of sectionPages.slice(0, 10)) {
      content += `- [${p.title}](${p.url})\n`;
    }
    content += '\n';
  }

  return content;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;

  if (!slug || slug.length === 0) {
    return NextResponse.json({ error: 'Path required' }, { status: 400 });
  }

  // Team1 Academy content is gated. The route manifest already blocks this at
  // the Edge, but that check reads the JWT cookie, so a revoked role keeps
  // working until the cookie refreshes. getAuthSession() re-reads UserRole, so
  // this is the authoritative check and revocation takes effect immediately.
  const isGatedContent = slug[0] === 'academy' && slug[1] === 'team1';
  const headers = isGatedContent ? privateMarkdownHeaders : markdownHeaders;

  if (isGatedContent) {
    const session = await getAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasPermission(session, { resource: 'academy:team1', action: 'read' })) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const [contentType, ...restPath] = slug;
  const entry = sourceMap[contentType];

  if (!entry) {
    return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
  }

  try {
    // Section root request (e.g., /api/raw/docs) — return a synthesized index
    if (restPath.length === 0) {
      const content = buildSectionIndex(entry.source, entry.label);
      return new NextResponse(content, { status: 200, headers });
    }

    const page = entry.source.getPage(restPath);

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const content = await getLLMText(page);

    return new NextResponse(content, { status: 200, headers });
  } catch (error) {
    console.error('Error fetching page:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
