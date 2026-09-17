import { ImageResponse } from 'next/og';
import { loadFonts } from '@/utils/og-image';
import {
  BrandRow,
  LedgerFooter,
  OG_HEIGHT,
  OG_INK,
  OG_MUTED,
  OG_PAD_X,
  OG_RED,
  OG_WIDTH,
  SheetFrame,
} from '@/utils/og/sheet';

export const runtime = 'edge';

// The site-wide fallback card: every page without an explicit og:image serves
// this via the createMetadata default (utils/metadata.ts).
export async function GET(): Promise<ImageResponse> {
  const fonts = await loadFonts();

  return new ImageResponse(
    (
      <SheetFrame>
        <BrandRow />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            justifyContent: 'center',
            padding: `0 ${OG_PAD_X}px`,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontFamily: 'Geist-Medium',
              fontSize: 64,
              letterSpacing: -1.5,
              color: OG_INK,
            }}
          >
            AVALANCHE BUILDER HUB<span style={{ color: OG_RED, marginLeft: -4 }}>.</span>
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 26,
              fontFamily: 'Geist-Mono',
              fontSize: 19,
              letterSpacing: 3,
              color: OG_MUTED,
            }}
          >
            DOCS · ACADEMY · CONSOLE · EXPLORER · GRANTS
          </div>
        </div>
        <LedgerFooter left="BUILD.AVAX.NETWORK" right="ONE NETWORK · TWO WAYS TO BUILD" />
      </SheetFrame>
    ),
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts: [
        { name: 'Geist-Medium', data: fonts.medium, weight: 600 },
        { name: 'Geist-Mono', data: fonts.regular, weight: 500 },
      ],
    },
  );
}
