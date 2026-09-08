import { ImageResponse } from 'next/og';
import { loadFonts, createOGResponse } from '@/utils/og-image';

export const runtime = 'edge';

// Referenced by app/(home)/audits/layout.tsx. Copy mirrors that layout's
// title + description so the card and the page's meta tags read the same.
export async function GET(): Promise<ImageResponse> {
  const fonts = await loadFonts();

  return createOGResponse({
    title: 'Security Audits',
    description:
      'Request audit quotes from every vetted security firm on the Ava Labs whitelist. Free, private, subsidized up to 75%.',
    path: 'audits',
    fonts,
  });
}
