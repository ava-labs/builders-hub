import type { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { loadFonts, createOGResponse } from '@/utils/og-image';
import { getHackathon } from '@/server/services/hackathons';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<ImageResponse> {
  const { id } = await params;
  const fonts = await loadFonts();

  try {
    const hackathon = await getHackathon(id);
    
    if (!hackathon) {
      return createOGResponse({
        title: 'Hackathon Not Found',
        description: 'The requested hackathon could not be found',
        path: 'hackathons',
        fonts
      });
    }

    return createOGResponse({
      title: hackathon.title,
      description: hackathon.description,
      path: 'hackathons',
      fonts
    });
  } catch (error) {
    return createOGResponse({
      title: 'Hackathons',
      description: 'Join exciting blockchain hackathons and build the future on Avalanche',
      path: 'hackathons',
      fonts
    });
  }
}