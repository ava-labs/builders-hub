import { ImageResponse } from 'next/og';
import { loadFonts, createOGResponse } from '@/utils/og-image';

export const runtime = 'edge';

// Unreferenced legacy share target (the toolbox pages moved into the console);
// kept alive so externally cached shares that embed this URL keep resolving.
export async function GET(): Promise<ImageResponse> {
  const fonts = await loadFonts();

  return createOGResponse({
    title: 'L1 Toolbox',
    description: 'Manage your L1 with a highly granular set of tools for the Avalanche ecosystem',
    path: 'tools/l1-toolbox',
    fonts,
  });
}
