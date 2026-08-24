import { ImageResponse } from 'next/og';
import { loadFonts, createOGResponse } from '@/utils/og-image';

export const runtime = 'edge';

export async function GET(): Promise<ImageResponse> {
  const fonts = await loadFonts();

  return createOGResponse({
    title: 'Showcase',
    description: 'Projects built by the Avalanche community across hackathons and programs',
    path: 'showcase',
    fonts,
  });
}
