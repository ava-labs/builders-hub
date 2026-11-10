import { ImageResponse } from 'next/og';
import { loadFonts, createOGResponse } from '@/utils/og-image';

export const runtime = 'edge';

export async function GET(): Promise<ImageResponse> {
  const fonts = await loadFonts();

  return createOGResponse({
    title: 'Ecosystem',
    description: 'Events, programs, guides and tools for builders on Avalanche',
    path: 'ecosystem',
    fonts,
  });
}
