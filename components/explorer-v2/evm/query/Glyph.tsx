"use client";

/* A suggestion's answer, drawn in miniature before it is asked: the
   shape of chart the question tends to get (columns, a ranking, a
   curve), in the topic's hue. The numbers are made up but steady per
   question, so a card looks the same on every visit. */

import type { Glyph as Kind } from "@/lib/explorer-query/examples";

const W = 160;
const H = 64;

/** a steady sequence in [0, 1) from a string */
function seq(key: string, n: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    out.push(((h ^ (h >>> 16)) >>> 0) / 4294967296);
  }
  return out;
}

/** a wave with some noise, 0.15..1 */
function wave(key: string, n: number): number[] {
  const r = seq(key, n);
  return r.map((v, i) => Math.min(1, Math.max(0.15, 0.55 + 0.28 * Math.sin(i / 2.1 + r[0] * 6) + (v - 0.5) * 0.35)));
}

function smooth(pts: [number, number][]): string {
  return pts.reduce((d, [x, y], i) => {
    if (i === 0) return `M${x},${y}`;
    const [px, py] = pts[i - 1];
    const cx = (px + x) / 2;
    return `${d} C${cx},${py} ${cx},${y} ${x},${y}`;
  }, "");
}

export function Glyph({ kind, hue, seed, className }: { kind: Kind; hue: string; seed: string; className?: string }) {
  const id = `g${seq(seed, 1)[0].toString(36).slice(2, 8)}`;
  let body: React.ReactNode;
  if (kind === "bars" || kind === "stack" || kind === "limit") {
    const n = 18;
    const v = wave(seed, n);
    const r = seq(`${seed}-top`, n);
    const bw = W / n - 2.5;
    body = (
      <>
        {kind === "limit" && <line x1={0} x2={W} y1={6} y2={6} stroke={hue} strokeOpacity={0.55} strokeDasharray="3 3" />}
        {v.map((h, i) => {
          const x = i * (W / n) + 1;
          const bh = (kind === "limit" ? h * 0.8 : h) * (H - 10);
          const top = kind === "stack" ? bh * (0.08 + r[i] * 0.2) : 0;
          return (
            <g key={i}>
              <rect x={x} y={H - bh} width={bw} height={bh - top} rx={1.5} fill={hue} fillOpacity={0.22 + h * 0.5} />
              {top > 0 && <rect x={x} y={H - bh - 1.5} width={bw} height={top} rx={1.5} fill="#E6212F" fillOpacity={0.85} />}
            </g>
          );
        })}
      </>
    );
  } else if (kind === "hbar") {
    const r = seq(seed, 5);
    const widths = [1, 0.62 + r[1] * 0.12, 0.44 + r[2] * 0.1, 0.3 + r[3] * 0.08, 0.2 + r[4] * 0.06];
    body = widths.map((w, i) => <rect key={i} x={0} y={i * 13 + 1} width={w * W} height={8} rx={4} fill={hue} fillOpacity={i === 0 ? 0.9 : 0.5 - i * 0.07} />);
  } else if (kind === "area" || kind === "line") {
    const n = kind === "line" ? 11 : 14;
    const v = wave(seed, n);
    const pts = v.map((h, i) => [(i / (n - 1)) * W, H - 4 - h * (H - 12)] as [number, number]);
    const d = smooth(pts);
    const [lx, ly] = pts[pts.length - 1];
    body = (
      <>
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={hue} stopOpacity={0.35} />
            <stop offset="100%" stopColor={hue} stopOpacity={0} />
          </linearGradient>
        </defs>
        {kind === "area" && <path d={`${d} L${W},${H} L0,${H} Z`} fill={`url(#${id})`} />}
        <path d={d} fill="none" stroke={hue} strokeWidth={2} strokeLinecap="round" />
        {kind === "line" && <path d={smooth(pts.map(([x, y]) => [x, Math.min(H - 2, y + 14)]))} fill="none" stroke={hue} strokeOpacity={0.35} strokeWidth={1.5} strokeDasharray="3 3" />}
        <circle cx={lx - 1} cy={ly} r={3.5} fill={hue} />
        <circle cx={lx - 1} cy={ly} r={7} fill={hue} fillOpacity={0.18} />
      </>
    );
  } else if (kind === "donut") {
    const r = seq(seed, 4);
    const parts = [0.42 + r[0] * 0.1, 0.22, 0.14 + r[2] * 0.05];
    const rest = Math.max(0.08, 1 - parts.reduce((a, b) => a + b, 0));
    const all = [...parts, rest];
    const R = 24;
    const C = 2 * Math.PI * R;
    let at = 0;
    body = (
      <g transform={`translate(${W - 34},${H / 2}) rotate(-90)`}>
        {all.map((p, i) => {
          const seg = (
            <circle key={i} r={R} fill="none" stroke={i === all.length - 1 ? "currentColor" : hue} strokeOpacity={i === all.length - 1 ? 0.12 : 0.95 - i * 0.25} strokeWidth={9} strokeDasharray={`${Math.max(0, p * C - 2)} ${C}`} strokeDashoffset={-at * C} />
          );
          at += p;
          return seg;
        })}
      </g>
    );
  } else {
    const n = 22;
    const r = seq(seed, n * 2);
    body = Array.from({ length: n }, (_, i) => {
      const x = 4 + (i / (n - 1)) * (W - 8);
      const big = i === Math.floor(n * 0.45);
      const y = big ? 8 : H - 6 - Math.pow(r[i * 2], 2.2) * (H * 0.45);
      return <circle key={i} cx={x} cy={y} r={big ? 4.5 : 2.6} fill={hue} fillOpacity={big ? 0.95 : 0.35 + r[i * 2 + 1] * 0.35} />;
    });
  }
  return (
    // columns and rankings stretch to the card; round marks keep their shape
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio={kind === "bars" || kind === "stack" || kind === "limit" || kind === "hbar" ? "none" : "xMaxYMax meet"} aria-hidden className={className} style={{ overflow: "visible" }}>
      {body}
    </svg>
  );
}
