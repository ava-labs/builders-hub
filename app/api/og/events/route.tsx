import { ImageResponse } from 'next/og';
import { loadFonts, createOGResponse } from '@/utils/og-image';

export const runtime = 'edge';

export async function GET(): Promise<ImageResponse> {
  const fonts = await loadFonts();

  return createOGResponse({
    title: 'Events',
    description: 'Discover upcoming events, hackathons, and conferences in the Avalanche ecosystem',
    path: 'events',
    fonts,
  });
}
