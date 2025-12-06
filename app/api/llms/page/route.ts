import { NextRequest, NextResponse } from 'next/server';
import { documentation, academy, integration, blog } from '@/lib/source';
import { getLLMText } from '@/lib/llm-utils';

/**
 * API route to fetch individual pages as markdown for LLM consumption.
 *
 * Usage: GET /api/llms/page?path=/docs/primary-network/overview
 *
 * Supports paths from:
 * - /docs/* - Documentation pages
 * - /academy/* - Academy course pages
 * - /integrations/* - Integration pages
 * - /blog/* - Blog posts
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const path = searchParams.get('path');

  if (!path) {
    return NextResponse.json(
      { error: 'Missing required parameter: path' },
      { status: 400 }
    );
  }

  // Normalize path - ensure it starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  try {
    let page;
    let source: string;

    // Determine which source to use based on path prefix
    if (normalizedPath.startsWith('/docs/')) {
      page = documentation.getPage(normalizedPath.slice('/docs'.length).split('/').filter(Boolean));
      source = 'docs';
    } else if (normalizedPath.startsWith('/academy/')) {
      page = academy.getPage(normalizedPath.slice('/academy'.length).split('/').filter(Boolean));
      source = 'academy';
    } else if (normalizedPath.startsWith('/integrations/')) {
      page = integration.getPage(normalizedPath.slice('/integrations'.length).split('/').filter(Boolean));
      source = 'integrations';
    } else if (normalizedPath.startsWith('/blog/')) {
      page = blog.getPage(normalizedPath.slice('/blog'.length).split('/').filter(Boolean));
      source = 'blog';
    } else {
      return NextResponse.json(
        { error: 'Invalid path. Must start with /docs/, /academy/, /integrations/, or /blog/' },
        { status: 400 }
      );
    }

    if (!page) {
      return NextResponse.json(
        { error: `Page not found: ${normalizedPath}` },
        { status: 404 }
      );
    }

    // Get the markdown content
    const markdown = await getLLMText(page);

    // Return as plain text markdown
    return new NextResponse(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        'X-Source': source,
        'X-Page-URL': page.url,
      },
    });
  } catch (error) {
    console.error('Error fetching page:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
