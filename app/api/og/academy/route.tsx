import { ImageResponse } from 'next/og';
import { loadFonts, createOGResponse } from '@/utils/og-image';

export const runtime = 'edge';

export async function GET(): Promise<ImageResponse> {
  const fonts = await loadFonts();

  return createOGResponse({
    title: 'Academy',
    description: 'Learn blockchain development with courses designed for the Avalanche ecosystem',
    path: 'academy',
    fonts,
  });
}
