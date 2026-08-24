import { ImageResponse } from 'next/og';
import { loadFonts, createOGResponse } from '@/utils/og-image';

export const runtime = 'edge';

export async function GET(): Promise<ImageResponse> {
  const fonts = await loadFonts();

  return createOGResponse({
    title: 'Console',
    description: 'Launch and operate Avalanche L1s: create chains, manage validators, and run interchain tooling',
    path: 'console',
    fonts,
  });
}
