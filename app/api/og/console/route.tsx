import type { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { loadFonts, createOGResponse } from '@/utils/og-image';

export const runtime = 'edge';

// Bare card for /console, and per-tool cards via ?title= (the CONSOLE label
// shows whenever the title is a tool name rather than "Console" itself).
export async function GET(request: NextRequest): Promise<ImageResponse> {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get('title');
  const description = searchParams.get('description');

  const fonts = await loadFonts();

  return createOGResponse({
    title: title ?? 'Console',
    description:
      description ??
      'Launch and operate Avalanche L1s: create chains, manage validators, and run interchain tooling',
    path: 'console',
    fonts,
  });
}
