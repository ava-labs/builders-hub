import type { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { loadFonts, createOGResponse } from '@/utils/og-image';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
): Promise<ImageResponse> {
  const { searchParams } = request.nextUrl;
  const rawTitle = searchParams.get('title');
  // Remove the suffix if present
  const title = rawTitle?.replace(/\s*\|\s*Avalanche Builder Hub$/, '');
  const description = searchParams.get('description');

  const fonts = await loadFonts();

  return createOGResponse({
    title: title ?? 'Academy',
    description: description ?? 'Learn blockchain development with courses designed for the Avalanche ecosystem',
    path: 'academy',
    fonts
  });
}