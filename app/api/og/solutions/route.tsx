import type { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { loadFonts, createOGResponse } from '@/utils/og-image';

export const runtime = 'edge';

// Bare card for /solutions, and per-pillar cards via ?title=&description=.
export async function GET(request: NextRequest): Promise<ImageResponse> {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get('title');
  const description = searchParams.get('description');

  const fonts = await loadFonts();

  return createOGResponse({
    title: title ?? 'Solutions',
    description:
      description ??
      'Performance, interoperability, privacy, and compliance: the four guarantees enterprise chains on Avalanche are built on',
    path: 'solutions',
    fonts,
  });
}
