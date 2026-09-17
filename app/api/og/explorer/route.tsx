import { ImageResponse } from 'next/og';
import { loadFonts, createOGResponse } from '@/utils/og-image';

export const runtime = 'edge';

export async function GET(): Promise<ImageResponse> {
  const fonts = await loadFonts();

  return createOGResponse({
    title: 'Avalanche Explorer',
    description: 'Search any block, transaction, address, or node across Avalanche, live',
    path: 'explorer',
    fonts,
  });
}
