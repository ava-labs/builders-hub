/**
 * Drafting-sheet primitives for OG (social preview) cards, rendered by satori
 * via next/og ImageResponse. satori has no SVG <pattern> support, so the
 * lattice is drawn as explicit lines (same geometry as SheetBackdrop, scaled
 * to the OG canvas). Single source of the new-brand card language; consumed
 * by utils/og-image.tsx and the app/api/og/* routes.
 */

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
export const OG_PAD_X = 64;

export const OG_INK = '#18181b';
export const OG_MUTED = '#71717a';
export const OG_FAINT = '#a1a1aa';
export const OG_RED = '#E6212F';
export const OG_HAIRLINE = 'rgba(24,24,27,0.15)';

// 90px rows give exactly 7 lattice rows on the 630px canvas.
const TRI_H = 90;
const TRI_S = TRI_H / Math.sin(Math.PI / 3); // = TRI_H / sin(60°)

function latticeLines(): React.ReactElement[] {
  const lines: React.ReactElement[] = [];
  const stroke = 'rgba(24,24,27,0.06)';
  for (let y = 0; y <= OG_HEIGHT; y += TRI_H) {
    lines.push(
      <line key={`h${y}`} x1={0} y1={y} x2={OG_WIDTH} y2={y} stroke={stroke} strokeWidth={1} />,
    );
  }
  const run = OG_HEIGHT / 1.732; // horizontal distance a 60° diagonal covers over full height
  for (let c = -Math.ceil(run / TRI_S) * TRI_S; c <= OG_WIDTH; c += TRI_S) {
    lines.push(
      <line key={`a${c}`} x1={c} y1={0} x2={c + run} y2={OG_HEIGHT} stroke={stroke} strokeWidth={1} />,
    );
    lines.push(
      <line key={`b${c}`} x1={c + run} y1={0} x2={c} y2={OG_HEIGHT} stroke={stroke} strokeWidth={1} />,
    );
  }
  return lines;
}

export function Logomark({ width = 44, height = 38 }: { width?: number; height?: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 220 190">
      <path
        fill={OG_RED}
        d="M109.14,23.04 C111.74,24.52 114.79,25.52 116.04,27.60 C123.77,40.44 131.11,53.51 138.55,66.53 C141.52,71.75 141.39,76.93 138.38,82.18 C122.78,109.33 107.21,136.49 91.73,163.71 C88.43,169.50 83.77,172.30 77.08,172.24 C62.58,172.11 48.08,172.24 33.58,172.18 C25.90,172.16 23.04,167.40 26.88,160.67 C49.34,121.33 71.90,82.04 94.42,42.74 C97.24,37.82 99.81,32.75 102.94,28.05 C104.30,26.00 106.78,24.70 109.14,23.04 z"
      />
      <path
        fill={OG_RED}
        d="M190.15,151.84 C192.16,155.32 194.13,158.41 195.81,161.65 C198.64,167.14 196.01,172.08 189.92,172.13 C171.13,172.29 152.34,172.29 133.55,172.12 C127.53,172.07 124.73,166.87 127.78,161.59 C136.92,145.76 146.17,129.99 155.55,114.31 C159.02,108.51 164.86,108.84 168.51,114.97 C175.76,127.10 182.83,139.33 190.15,151.84 z"
      />
    </svg>
  );
}

/** White sheet with the lattice backdrop and palette blips, clear of the content zones. */
export function SheetFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: '#ffffff',
        position: 'relative',
      }}
    >
      <svg
        width={OG_WIDTH}
        height={OG_HEIGHT}
        viewBox={`0 0 ${OG_WIDTH} ${OG_HEIGHT}`}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        {latticeLines()}
        <polygon points="940,90 888.04,180 991.96,180" fill="rgba(230,33,47,0.12)" />
        <polygon points="1020,540 968.04,450 1071.96,450" fill="rgba(0,97,226,0.10)" />
        <polygon points="400,180 348.04,90 451.96,90" fill="rgba(162,175,178,0.14)" />
      </svg>
      {children}
    </div>
  );
}

export function BrandRow() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        padding: `44px ${OG_PAD_X}px 0 ${OG_PAD_X}px`,
      }}
    >
      <Logomark />
      <div
        style={{
          display: 'flex',
          fontFamily: 'Geist-Mono',
          fontSize: 18,
          letterSpacing: 5,
          color: '#3f3f46',
        }}
      >
        AVALANCHE BUILDER HUB
      </div>
    </div>
  );
}

export function SectionLabel({ text }: { text: string }) {
  return (
    <div
      style={{
        display: 'flex',
        fontFamily: 'Geist-Mono',
        fontSize: 17,
        letterSpacing: 4,
        color: OG_RED,
      }}
    >
      {text}
    </div>
  );
}

/** Dark ledger footer bar, echoing the stats board. */
export function LedgerFooter({ left, right }: { left: string; right: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: OG_INK,
        padding: `22px ${OG_PAD_X}px`,
      }}
    >
      <div
        style={{
          display: 'flex',
          fontFamily: 'Geist-Mono',
          fontSize: 17,
          letterSpacing: 3,
          color: '#fafafa',
        }}
      >
        {left}
      </div>
      <div
        style={{
          display: 'flex',
          fontFamily: 'Geist-Mono',
          fontSize: 17,
          letterSpacing: 3,
          color: OG_FAINT,
        }}
      >
        {right}
      </div>
    </div>
  );
}

/** Character-based truncation: deterministic under satori (no line-clamp quirks). */
export function clampText(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
