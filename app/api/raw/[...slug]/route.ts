import { NextRequest, NextResponse } from 'next/server';
import { documentation, academy, integration, blog } from '@/lib/source';
import { getLLMText } from '@/lib/llm-utils';
import { getToken } from 'next-auth/jwt';
import { hasTeam1AcademyAccess } from '@/lib/auth/roles';
import { isTeam1Slug } from '@/lib/auth/normalize-path';

const markdownHeaders = {
  'Content-Type': 'text/markdown; charset=utf-8',
  'Cache-Control': 'public, max-age=3600, s-maxage=3600',
  'Vary': 'Accept',
};

// Team1 pages are for signed-in members only: never store them in a shared cache.
const privateMarkdownHeaders = {
  ...markdownHeaders,
  'Cache-Control': 'private, no-store',
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;

  if (!slug || slug.length === 0) {
    return NextResponse.json({ error: 'Path required' }, { status: 400 });
  }

  const [contentType, ...restPath] = slug;
  const entry = sourceMap[contentType];

  if (!entry) {
    return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
  }

  const page = restPath.length > 0 ? entry.source.getPage(restPath) : undefined;

  // Team1 Academy: every raw markdown request ends here (`/api/raw`, a `.md`
  // URL, markdown negotiation), and for a signed-out `.md` request this is
  // the only check. It reads the requested slug and the page that the slug
  // resolves to, so no spelling of the path can skip it.
  const isTeam1 = contentType === 'academy' && (isTeam1Slug(restPath) || isTeam1Slug(page?.slugs));
  if (isTeam1) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!hasTeam1AcademyAccess(token.custom_attributes as string[] | undefined)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  try {
    // Section root request (e.g., /api/raw/docs): return a synthesized index
    if (restPath.length === 0) {
      const content = buildSectionIndex(entry.source, entry.label);
      return new NextResponse(content, { status: 200, headers: markdownHeaders });
    }

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    const content = await getLLMText(page);

    return new NextResponse(content, { status: 200, headers: isTeam1 ? privateMarkdownHeaders : markdownHeaders });
  } catch (error) {
    console.error('Error fetching page:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
