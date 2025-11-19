import type { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { loadFonts, createOGResponse } from '@/utils/og-image';
import axios from 'axios';

export const runtime = 'edge';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<ImageResponse> {
  const { id } = await params;
  const fonts = await loadFonts();

  try {
    const res = await axios.get(
      `${process.env.NEXTAUTH_URL}/api/hackathons/${id}`,
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );

    const hackathon = res.data || null;
    
    if (!hackathon) {
      return createOGResponse({
        title: 'Hackathon Not Found',
        description: 'The requested hackathon could not be found',
        path: 'hackathons',
        fonts
      });
    }

    // If hackathon has a banner, show it as the OG image
    if (hackathon.banner && hackathon.banner.trim() !== '') {
      try {
        // Fetch the banner image with axios
        const imageResponse = await axios.get(hackathon.banner, {
          responseType: 'arraybuffer',
          headers: {
            'Accept': 'image/*',
          },
        });

        const imageBuffer = imageResponse.data;
        
        // Check if we got actual image data
        if (!imageBuffer || imageBuffer.byteLength === 0) {
          throw new Error('Banner image is empty');
        }
        
        // Convert ArrayBuffer to base64 in Edge Runtime
        const base64 = btoa(
          new Uint8Array(imageBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ''
          )
        );
        const contentType = imageResponse.headers['content-type'] || 'image/png';
        const imageDataUrl = `data:${contentType};base64,${base64}`;

        return new ImageResponse(
          (
            <div
              style={{
                display: 'flex',
                height: '100%',
                width: '100%',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <img
                src={imageDataUrl}
                alt={hackathon.title}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </div>
          ),
          {
            width: 1280,
            height: 720,
            fonts: [
              { name: 'Geist-Medium', data: fonts.medium, weight: 600 },
              { name: 'Geist-Mono', data: fonts.regular, weight: 500 },
              { name: 'Geist-Light', data: fonts.light, weight: 300 }
            ],
          }
        );
      } catch (imageError: any) {
        // If banner fails to load, silently fallback to title/description
        // This is expected behavior when banner doesn't exist or fails to load
        if (imageError.response?.status !== 404) {
          console.warn('Failed to load banner image:', imageError.message);
        }
        return createOGResponse({
          title: hackathon.title,
          description: hackathon.description,
          path: 'hackathons',
          fonts
        });
      }
    }

    // If no banner, show title and description
    return createOGResponse({
      title: hackathon.title,
      description: hackathon.description,
      path: 'hackathons',
      fonts
    });

  } catch (error: any) {
    console.error('Error fetching hackathon:', error.message || error);
    return createOGResponse({
      title: 'Hackathons',
      description: 'Join exciting blockchain hackathons and build the future on Avalanche',
      path: 'hackathons',
      fonts
    });
  }
}
