import type { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { loadFonts, createOGResponse } from '@/utils/og-image';
import axios from 'axios';

export const runtime = 'edge';

// Helper function to generate OG variant URL from banner URL
function generateOGBannerUrl(bannerUrl: string): string {
  try {
    const url = new URL(bannerUrl);
    const pathname = url.pathname;
    const lastDotIndex = pathname.lastIndexOf('.');
    
    if (lastDotIndex === -1) {
      // No extension found, just append -og
      url.pathname = pathname + '-og';
      return url.toString();
    }
    
    // Insert -og before the extension
    const basePath = pathname.substring(0, lastDotIndex);
    const extension = pathname.substring(lastDotIndex);
    url.pathname = basePath + '-og' + extension;
    return url.toString();
  } catch {
    // If URL parsing fails, try simple string replacement
    const lastDotIndex = bannerUrl.lastIndexOf('.');
    if (lastDotIndex === -1) {
      return bannerUrl + '-og';
    }
    return bannerUrl.substring(0, lastDotIndex) + '-og' + bannerUrl.substring(lastDotIndex);
  }
}

// Helper function to try loading an image and return ImageResponse if successful
async function tryLoadImage(
  imageUrl: string,
  hackathonTitle: string,
  fonts: { medium: ArrayBuffer, light: ArrayBuffer, regular: ArrayBuffer }
): Promise<ImageResponse | null> {
  try {
    const imageResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: {
        'Accept': 'image/*',
      },
    });

    const imageBuffer = imageResponse.data;
    
    if (!imageBuffer || imageBuffer.byteLength === 0) {
      return null;
    }
    
    const contentType = imageResponse.headers['content-type'] || 'image/png';
    
    // Skip WebP images as they cause issues with ImageResponse
    if (contentType.includes('webp') || contentType === 'image/webp') {
      return null;
    }
    
    // Convert ArrayBuffer to base64 in Edge Runtime
    const base64 = btoa(
      new Uint8Array(imageBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ''
      )
    );
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
            alt={hackathonTitle}
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
  } catch (error: any) {
    // Return null if image fails to load (404, network error, etc.)
    return null;
  }
}

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

    // Try to load images in fallback order
    if (hackathon.banner && hackathon.banner.trim() !== '') {
      // Fallback 1: Try banner with -og suffix
      const ogBannerUrl = generateOGBannerUrl(hackathon.banner);
      const ogImage = await tryLoadImage(ogBannerUrl, hackathon.title, fonts);
      if (ogImage) {
        return ogImage;
      }

      // Fallback 2: Try small_banner if available
      if (hackathon.small_banner && hackathon.small_banner.trim() !== '') {
        const smallBannerImage = await tryLoadImage(hackathon.small_banner, hackathon.title, fonts);
        if (smallBannerImage) {
          return smallBannerImage;
        }
      }

      // Fallback 3: Try original banner
      const bannerImage = await tryLoadImage(hackathon.banner, hackathon.title, fonts);
      if (bannerImage) {
        return bannerImage;
      }
    } else if (hackathon.small_banner && hackathon.small_banner.trim() !== '') {
      // If no banner but has small_banner, try it
      const smallBannerImage = await tryLoadImage(hackathon.small_banner, hackathon.title, fonts);
      if (smallBannerImage) {
        return smallBannerImage;
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
