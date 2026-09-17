import { ImageResponse } from 'next/og';
import { loadFonts, createOGResponse } from '@/utils/og-image';

export const runtime = 'edge';

export async function GET(): Promise<ImageResponse> {
  const fonts = await loadFonts();

  return createOGResponse({
    title: 'Integrations',
    description: 'Discover best-in-class integrations for your Avalanche L1',
    path: 'integrations',
    fonts,
  });
}
