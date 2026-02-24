import { NextRequest, NextResponse } from 'next/server';
import { documentation, academy, integration, blog } from '@/lib/source';
import { getLLMText } from '@/lib/llm-utils';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;

  if (!slug || slug.length === 0) {
    return NextResponse.json({ error: 'Path required' }, { status: 400 });
  }

  const [contentType, ...restPath] = slug;

  if (!['docs', 'academy', 'blog', 'integrations'].includes(contentType)) {
    return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
  }

  try {
    let page;

    // Get page from appropriate source
    switch (contentType) {
      case 'docs':
        page = documentation.getPage(restPath);
        break;
      case 'academy':
        page = academy.getPage(restPath);
        break;
      case 'blog':
        page = blog.getPage(restPath);
        break;
      case 'integrations':
        page = integration.getPage(restPath);
        break;
    }

    if (!page) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    // Get processed markdown content
    const content = await getLLMText(page);

    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error('Error fetching page:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
