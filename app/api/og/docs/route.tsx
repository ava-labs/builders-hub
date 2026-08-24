import { ImageResponse } from 'next/og';
import { loadFonts, createOGResponse } from '@/utils/og-image';

export const runtime = 'edge';

export async function GET(): Promise<ImageResponse> {
  const fonts = await loadFonts();

  return createOGResponse({
    title: 'Documentation',
    description: 'Developer documentation for everything related to the Avalanche ecosystem',
    path: 'docs',
    fonts,
  });
}
