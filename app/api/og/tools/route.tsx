import { ImageResponse } from 'next/og';
import { loadFonts, createOGResponse } from '@/utils/og-image';

export const runtime = 'edge';

// Unreferenced legacy share target (the toolbox pages moved into the console);
// kept alive so externally cached shares that embed this URL keep resolving.
export async function GET(): Promise<ImageResponse> {
  const fonts = await loadFonts();

  return createOGResponse({
    title: 'Tools',
    description: 'Discover developer tools and resources for building on Avalanche',
    path: 'tools',
    fonts,
  });
}
