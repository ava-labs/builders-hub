import type { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { loadFonts, createOGResponse } from '@/utils/og-image';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
): Promise<ImageResponse> {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get('title');
  const description = searchParams.get('description');
  const path = searchParams.get('path');
  const backgroundImage = searchParams.get('backgroundImage');

  const fonts = await loadFonts();

  return createOGResponse({
    title: title ?? 'Hackathons',
    description: description ?? 'Join exciting blockchain hackathons and build the future on Avalanche',
    path: path ?? 'hackathons',
    backgroundImage: backgroundImage || undefined,
    fonts
  });
}