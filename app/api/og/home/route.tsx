import { ImageResponse } from 'next/og';
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

const display = fetch(new URL('../Aeonik-Black.ttf', import.meta.url)).then((res) =>
  res.arrayBuffer(),
);

const mono = fetch(new URL('../GeistMono-Light.ttf', import.meta.url)).then((res) =>
  res.arrayBuffer(),
);

// The homepage's statement card, on the shared drafting-sheet primitives.
// Statement face and copy follow the design-investigation pass (Aeonik Black,
// "BUILD A NETWORK."), sized for the 1200x630 canvas.
export async function GET(): Promise<ImageResponse> {
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
              fontFamily: 'Aeonik',
              fontSize: 98,
              letterSpacing: -1,
              color: OG_INK,
            }}
          >
            BUILD A NETWORK<span style={{ color: OG_RED, marginLeft: -6 }}>.</span>
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 32,
              fontFamily: 'Geist-Mono',
              fontSize: 19,
              letterSpacing: 3,
              color: OG_MUTED,
            }}
          >
            SUB-SECOND FINALITY · NATIVE INTEROP · PUBLIC, PERMISSIONED, OR PRIVATE
          </div>
        </div>
        <LedgerFooter left="BUILD.AVAX.NETWORK" right="ONE NETWORK · TWO WAYS TO BUILD" />
      </SheetFrame>
    ),
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts: [
        { name: 'Aeonik', data: await display, weight: 900 },
        { name: 'Geist-Mono', data: await mono, weight: 500 },
      ],
    },
  );
}
