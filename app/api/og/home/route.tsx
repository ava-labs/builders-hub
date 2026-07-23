import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const medium = fetch(new URL('../Geist-Medium.ttf', import.meta.url)).then((res) =>
  res.arrayBuffer(),
);

const mono = fetch(new URL('../GeistMono-Light.ttf', import.meta.url)).then((res) =>
  res.arrayBuffer(),
);

const W = 1280;
const H = 720;

// The homepage's drafting-sheet lattice, drawn as explicit lines (satori
// doesn't support SVG <pattern>). Same geometry as SheetBackdrop, scaled up.
const TRI_H = 96;
const TRI_S = 110.85; // TRI_H / sin(60°)

function latticeLines(): React.ReactElement[] {
  const lines: React.ReactElement[] = [];
  const stroke = 'rgba(24,24,27,0.06)';
  for (let y = 0; y <= H; y += TRI_H) {
    lines.push(<line key={`h${y}`} x1={0} y1={y} x2={W} y2={y} stroke={stroke} strokeWidth={1} />);
  }
  const run = H / 1.732; // horizontal distance a 60° diagonal covers over full height
  for (let c = -Math.ceil(run / TRI_S) * TRI_S; c <= W; c += TRI_S) {
    lines.push(
      <line key={`a${c}`} x1={c} y1={0} x2={c + run} y2={H} stroke={stroke} strokeWidth={1} />,
    );
    lines.push(
      <line key={`b${c}`} x1={c + run} y1={0} x2={c} y2={H} stroke={stroke} strokeWidth={1} />,
    );
  }
  return lines;
}

export async function GET(): Promise<ImageResponse> {
  return new ImageResponse(
    (
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
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          {latticeLines()}
          {/* lattice blips in the page's palette, clear of the statement */}
          <polygon points="1053.07,96 997.65,192 1108.5,192" fill="rgba(230,33,47,0.12)" />
          <polygon points="886.8,576 831.38,480 942.23,480" fill="rgba(0,97,226,0.10)" />
          <polygon points="388,192 332.55,96 443.4,96" fill="rgba(162,175,178,0.14)" />
        </svg>

        {/* brand row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            padding: '56px 72px 0 72px',
          }}
        >
          <svg width="52" height="45" viewBox="0 0 220 190">
            <path
              fill="#E6212F"
              d="M109.14,23.04 C111.74,24.52 114.79,25.52 116.04,27.60 C123.77,40.44 131.11,53.51 138.55,66.53 C141.52,71.75 141.39,76.93 138.38,82.18 C122.78,109.33 107.21,136.49 91.73,163.71 C88.43,169.50 83.77,172.30 77.08,172.24 C62.58,172.11 48.08,172.24 33.58,172.18 C25.90,172.16 23.04,167.40 26.88,160.67 C49.34,121.33 71.90,82.04 94.42,42.74 C97.24,37.82 99.81,32.75 102.94,28.05 C104.30,26.00 106.78,24.70 109.14,23.04 z"
            />
            <path
              fill="#E6212F"
              d="M190.15,151.84 C192.16,155.32 194.13,158.41 195.81,161.65 C198.64,167.14 196.01,172.08 189.92,172.13 C171.13,172.29 152.34,172.29 133.55,172.12 C127.53,172.07 124.73,166.87 127.78,161.59 C136.92,145.76 146.17,129.99 155.55,114.31 C159.02,108.51 164.86,108.84 168.51,114.97 C175.76,127.10 182.83,139.33 190.15,151.84 z"
            />
          </svg>
          <div
            style={{
              display: 'flex',
              fontFamily: 'Geist-Mono',
              fontSize: 22,
              letterSpacing: 6,
              color: '#3f3f46',
            }}
          >
            AVALANCHE BUILDER HUB
          </div>
        </div>

        {/* statement */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            justifyContent: 'center',
            padding: '0 72px',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontFamily: 'Geist-Medium',
              fontSize: 104,
              letterSpacing: -3,
              color: '#18181b',
            }}
          >
            LAUNCH A NETWORK<span style={{ color: '#E6212F', marginLeft: -8 }}>.</span>
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 36,
              fontFamily: 'Geist-Mono',
              fontSize: 19,
              letterSpacing: 3,
              color: '#71717a',
            }}
          >
            SUB-SECOND FINALITY · NATIVE INTEROP · PUBLIC, PERMISSIONED, OR PRIVATE
          </div>
        </div>

        {/* ledger footer bar, echoing the stats board */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#18181b',
            padding: '26px 72px',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontFamily: 'Geist-Mono',
              fontSize: 20,
              letterSpacing: 4,
              color: '#fafafa',
            }}
          >
            BUILD.AVAX.NETWORK
          </div>
          <div
            style={{
              display: 'flex',
              fontFamily: 'Geist-Mono',
              fontSize: 20,
              letterSpacing: 4,
              color: '#a1a1aa',
            }}
          >
            ONE NETWORK · TWO WAYS TO BUILD
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: [
        { name: 'Geist-Medium', data: await medium, weight: 600 },
        { name: 'Geist-Mono', data: await mono, weight: 500 },
      ],
    },
  );
}
