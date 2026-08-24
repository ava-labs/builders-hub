import { ImageResponse } from 'next/og';
import { loadFonts, createOGResponse } from '@/utils/og-image';

export const runtime = 'edge';

// Referenced by app/(home)/university/layout.tsx; this route not existing was a
// live 404 before the rebrand.
export async function GET(): Promise<ImageResponse> {
  const fonts = await loadFonts();

  return createOGResponse({
    title: 'University',
    description: 'Opportunities for students and educators to explore blockchain technology on Avalanche',
    path: 'university',
    fonts,
  });
}
