import type { JSX } from 'react';
import { CERTIFICATE_MARKS } from './certificate-marks';
import { layoutCertificate, type CertificateLayout } from './certificate-layout';

export const CERTIFICATE_VIEWBOX = { width: 1920, height: 1080 } as const;

export type CertificateAcademy = 'Avalanche Academy' | 'Entrepreneur Academy';

export interface CertificateFieldBox { x: number; y: number; width: number; height: number } // viewBox units, origin top-left

/** The Entrepreneur templates' "Enter Name" and "Enter Date" field rectangles, where the template PDFs built from this drawing place their form fields. */
export const CERTIFICATE_FIELDS: { name: CertificateFieldBox; date: CertificateFieldBox } = {
  name: { x: 320, y: 935, width: 500, height: 29 },
  date: { x: 1430, y: 935, width: 250, height: 29 },
};

export function certificateAcademyFor(track: string): CertificateAcademy {
  return track === 'entrepreneur' ? 'Entrepreneur Academy' : 'Avalanche Academy';
}

export interface CertificateArtworkProps { academy: CertificateAcademy; courseTitle: string; className?: string }

// Print colours of the template (a print design, so hex values live here).
const RED = '#FF394A';
const WHITE = '#FFFFFF';
const BLACK = '#000000';
const MARK_WIDTH = 5.8;
const TITLE_X = 155.4;
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

function BorderMarks() {
  const dots = CERTIFICATE_MARKS.filter(([, , length]) => length - MARK_WIDTH < 1);
  const slashes = CERTIFICATE_MARKS.filter(([, , length]) => length - MARK_WIDTH >= 1);
  return (
    <>
      <g fill={WHITE}>
        {dots.map(([x, y, , opacity]) => <circle key={`${x},${y}`} cx={x} cy={y} r={MARK_WIDTH / 2} opacity={opacity} />)}
      </g>
      <g stroke={WHITE} strokeWidth={MARK_WIDTH} strokeLinecap="round">
        {slashes.map(([x, y, length, opacity]) => {
          const half = (length - MARK_WIDTH) / 2; // each slash rises to the right at 60 degrees
          return (
            <line
              key={`${x},${y}`}
              x1={round1(x - half / 2)}
              y1={round1(y + (half * Math.sqrt(3)) / 2)}
              x2={round1(x + half / 2)}
              y2={round1(y - (half * Math.sqrt(3)) / 2)}
              opacity={opacity}
            />
          );
        })}
      </g>
    </>
  );
}

function TitleLines({ layout }: { layout: CertificateLayout }) {
  return (
    <text x={TITLE_X} fontSize={layout.size} fontWeight={700} letterSpacing={round2(-0.02 * layout.size)} fill="url(#ac-cert-title)">
      {layout.lines.map((line, i) => (
        <tspan key={i} x={TITLE_X} y={layout.baselines[i]}>{line}</tspan>
      ))}
    </text>
  );
}

/**
 * The course certificate in the Entrepreneur Academy template's layout: one SVG, no hooks, so
 * react-dom/server can render it for the PDFs. The name and date areas stay empty.
 */
export function CertificateArtwork({ academy, courseTitle, className }: CertificateArtworkProps): JSX.Element {
  const layout = layoutCertificate(courseTitle);
  return (
    <svg
      viewBox={`0 0 ${CERTIFICATE_VIEWBOX.width} ${CERTIFICATE_VIEWBOX.height}`}
      role="img"
      aria-label={`${academy}, Certificate of Completion, ${courseTitle}`}
      className={className}
      // A white sheet under the red frame: whatever reads the colour behind the text reads white.
      style={{ backgroundColor: WHITE }}
      fontFamily="Aeonik, sans-serif"
    >
      <defs>
        <linearGradient id="ac-cert-rule">
          <stop offset="0" stopColor={RED} />
          <stop offset="1" stopColor={BLACK} />
        </linearGradient>
        <linearGradient id="ac-cert-title">
          <stop offset="0" stopColor={BLACK} />
          <stop offset="1" stopColor={RED} />
        </linearGradient>
      </defs>
      <rect width={CERTIFICATE_VIEWBOX.width} height={CERTIFICATE_VIEWBOX.height} fill={RED} />
      <BorderMarks />
      <rect x={53} y={55} width={1814} height={970} rx={32} fill={WHITE} />
      <image href="/logo-black.png" x={791.3} y={94} width={330.7} height={57.1} />
      <g fill={BLACK}>
        <text x={955.5} y={240.8} textAnchor="middle" fontSize={95} fontWeight={700} letterSpacing={-3.33}>{academy}</text>
        <text x={155.3} y={layout.labelY} fontSize={50} fontWeight={500} letterSpacing={-0.1}>Certificate of Completion</text>
        <text x={162.6} y={958} fontSize={23.5} fontWeight={700} letterSpacing={-0.2}>Presented To:</text>
        <text x={1369.6} y={958} fontSize={23.5} fontWeight={700} letterSpacing={-0.2}>Date:</text>
      </g>
      {layout.rules.map((y) => <rect key={y} x={162} y={y} width={1603} height={12} fill="url(#ac-cert-rule)" />)}
      <TitleLines layout={layout} />
    </svg>
  );
}
