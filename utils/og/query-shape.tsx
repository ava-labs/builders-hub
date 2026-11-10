import type { ShareShape } from '@/lib/explorer-query/share';
import { OG_FAINT, OG_HAIRLINE, OG_INK, OG_RED } from './sheet';

/**
 * The drawing on a Query answer's share card (app/api/og/query): one fixed
 * sketch per panel kind of the answer's layout. It names the answer's shape
 * and holds no data, so a cached card never shows a stale figure.
 */

const W = 240;
const H = 150;
const SOFT = 'rgba(24,24,27,0.28)';
const PALE = 'rgba(24,24,27,0.12)';

const axis = <line x1={0} y1={H - 1} x2={W} y2={H - 1} stroke={OG_HAIRLINE} strokeWidth={2} />;

function bars(heights: number[], gap: number, red: number) {
  const step = W / heights.length;
  return heights.map((h, i) => (
    <rect key={i} x={i * step + gap / 2} y={H - 2 - h} width={step - gap} height={h} fill={i === red ? OG_RED : OG_INK} />
  ));
}

const SERIES = '0,112 30,96 60,104 90,70 120,78 150,44 180,56 210,24 240,32';

const SHAPES: Record<ShareShape, React.ReactNode> = {
  hbar: [208, 164, 122, 86, 54].map((w, i) => (
    <rect key={i} x={0} y={6 + i * 29} width={w} height={18} fill={i === 0 ? OG_RED : OG_INK} />
  )),
  bar: [axis, ...bars([52, 84, 66, 112, 92, 134, 78, 104], 10, 5)],
  line: [axis, <polyline key="l" points={SERIES} fill="none" stroke={OG_RED} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />],
  area: [
    axis,
    <polygon key="a" points={`0,${H - 2} ${SERIES} ${W},${H - 2}`} fill="rgba(230,33,47,0.16)" />,
    <polyline key="l" points={SERIES} fill="none" stroke={OG_RED} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />,
  ],
  scatter: [
    axis,
    <line key="y" x1={1} y1={0} x2={1} y2={H} stroke={OG_HAIRLINE} strokeWidth={2} />,
    ...[
      [30, 118], [52, 96], [70, 108], [92, 80], [112, 90], [128, 62], [150, 72], [170, 44], [192, 52], [214, 24],
    ].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={7} fill={i === 9 ? OG_RED : OG_INK} />),
  ],
  flow: [
    <path key="f1" d="M14,34 C120,34 120,22 226,22" fill="none" stroke="rgba(230,33,47,0.45)" strokeWidth={22} />,
    <path key="f2" d="M14,58 C120,58 120,76 226,76" fill="none" stroke={PALE} strokeWidth={16} />,
    <path key="f3" d="M14,112 C120,112 120,128 226,128" fill="none" stroke={SOFT} strokeWidth={20} />,
    <rect key="a" x={0} y={18} width={14} height={52} fill={OG_INK} />,
    <rect key="b" x={0} y={96} width={14} height={32} fill={OG_INK} />,
    <rect key="c" x={226} y={8} width={14} height={28} fill={OG_INK} />,
    <rect key="d" x={226} y={64} width={14} height={24} fill={OG_INK} />,
    <rect key="e" x={226} y={114} width={14} height={28} fill={OG_INK} />,
  ],
  dumbbell: [
    [40, 150], [72, 208], [28, 96], [110, 176],
  ].flatMap(([from, to], i) => [
    <line key={`l${i}`} x1={from} y1={20 + i * 37} x2={to} y2={20 + i * 37} stroke={SOFT} strokeWidth={4} />,
    <circle key={`a${i}`} cx={from} cy={20 + i * 37} r={8} fill={OG_FAINT} />,
    <circle key={`b${i}`} cx={to} cy={20 + i * 37} r={8} fill={OG_RED} />,
  ]),
  diverging: [
    ...[84, 52, -38, 24, -70].map((w, i) => (
      <rect key={i} x={w > 0 ? 120 : 120 + w} y={6 + i * 29} width={Math.abs(w)} height={18} fill={w > 0 ? OG_INK : OG_RED} />
    )),
    <line key="z" x1={120} y1={0} x2={120} y2={H} stroke={OG_INK} strokeWidth={2} />,
  ],
  histogram: [axis, ...bars([10, 22, 44, 78, 116, 134, 108, 70, 40, 20, 10, 6], 2, -1)],
  heatmap: [0.1, 0.3, 0.16, 0.55, 0.8, 0.4, 0.2, 0.5, 0.34, 0.9, 0.62, 0.24, 0.08, 0.22, 0.46, 0.7, 1, 0.5, 0.14, 0.1, 0.28, 0.4, 0.58, 0.3].map((o, i) => (
    <rect key={i} x={(i % 6) * 40 + 2} y={Math.floor(i / 6) * 37 + 3} width={36} height={33} fill={`rgba(230,33,47,${o})`} />
  )),
  treemap: [
    <rect key="a" x={0} y={0} width={132} height={H} fill={OG_RED} />,
    <rect key="b" x={136} y={0} width={104} height={84} fill={OG_INK} />,
    <rect key="c" x={136} y={88} width={60} height={62} fill={SOFT} />,
    <rect key="d" x={200} y={88} width={40} height={34} fill={OG_FAINT} />,
    <rect key="e" x={200} y={126} width={40} height={24} fill={PALE} />,
  ],
  table: [
    <rect key="h" x={0} y={4} width={W} height={24} fill={OG_INK} />,
    ...[0, 1, 2, 3].flatMap((r) => [
      <rect key={`a${r}`} x={0} y={44 + r * 28} width={[96, 72, 110, 84][r]} height={10} fill={SOFT} />,
      <rect key={`b${r}`} x={150} y={44 + r * 28} width={[38, 52, 30, 44][r]} height={10} fill={PALE} />,
      <rect key={`c${r}`} x={206} y={44 + r * 28} width={34} height={10} fill={PALE} />,
    ]),
  ],
  ask: [
    <rect key="box" x={1} y={30} width={W - 2} height={48} fill="none" stroke={OG_INK} strokeWidth={2} />,
    <rect key="text" x={16} y={49} width={120} height={10} fill={SOFT} />,
    <rect key="caret" x={144} y={42} width={4} height={24} fill={OG_RED} />,
    <rect key="l1" x={1} y={100} width={150} height={8} fill={PALE} />,
    <rect key="l2" x={1} y={118} width={100} height={8} fill={PALE} />,
  ],
};

export function QueryShape({ shape, label }: { shape: ShareShape; label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 304,
        padding: '30px 32px 22px 32px',
        backgroundColor: '#ffffff',
        border: `1.5px solid ${OG_HAIRLINE}`,
      }}
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        {SHAPES[shape]}
      </svg>
      <div style={{ display: 'flex', marginTop: 20, fontFamily: 'Geist-Mono', fontSize: 15, letterSpacing: 3, color: OG_FAINT }}>
        {label.toUpperCase()}
      </div>
    </div>
  );
}
