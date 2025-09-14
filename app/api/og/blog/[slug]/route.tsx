import type { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { loadFonts, createOGResponse } from '@/utils/og-image';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<ImageResponse> {
  const { slug } = await params;
  const { searchParams } = request.nextUrl;
  const rawTitle = searchParams.get('title');
  const title = rawTitle?.replace(/\s*\|\s*Avalanche Builder Hub$/, '');
  const description = searchParams.get('description');
  const fonts = await loadFonts();

  return createOGResponse({
    title: title ?? 'Blog Post',
    description: description ?? 'Takeaways and tutorials from building a network of fast, efficient, highly-optimized chains.',
    path: 'blog',
    fonts
  });
}