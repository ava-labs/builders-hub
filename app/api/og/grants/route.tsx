import { ImageResponse } from 'next/og';
import { loadFonts, createOGResponse } from '@/utils/og-image';

export const runtime = 'edge';

export async function GET(): Promise<ImageResponse> {
  const fonts = await loadFonts();

  return createOGResponse({
    title: 'Grants',
    description: 'Explore grants and other funding opportunities for builders in the Avalanche ecosystem',
    path: 'grants',
    fonts,
  });
}
