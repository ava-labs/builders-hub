import type { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { loadFonts, createOGResponse } from '@/utils/og-image';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
): Promise<ImageResponse> {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get('title'),
    description = searchParams.get('description');

  const fonts = await loadFonts();

  return createOGResponse({
    title: title ?? 'Academy | Avalanche Builder Hub',
    description: description ?? 'Learn blockchain development with courses designed for the Avalanche ecosystem',
    path: 'academy',
    fonts
  });
}