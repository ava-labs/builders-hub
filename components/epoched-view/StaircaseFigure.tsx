import { staleViewFigure } from "./data/figure";
import {
  figureDesktop,
  figureMobile,
  glossaryMark,
  LEGEND_LINE_1,
  LEGEND_LINE_2,
  legendSwatch,
  mapX,
  mapY,
  markGlossary,
  seriesPath,
  seriesYAt,
  stairPoints,
  viewSeriesPoints,
  type FigureLayout,
} from "./timeline-layouts";

const ACCENT = "#E6212F";
const STEEL = "#A2AFB2";

const INK_STROKE = "stroke-zinc-900 dark:stroke-zinc-100";
const SOFT_FILL = "fill-zinc-600 dark:fill-zinc-300";
const MUTE_FILL = "fill-zinc-500 dark:fill-zinc-400";
const FAINT_STROKE = "stroke-zinc-400 dark:stroke-zinc-600";

/**
 * The stamped round-3.2 staircase: two series, their marks, one red gap
 * dimension, a three-row legend, and three phase words. No animation of any
 * kind. Label-lane law: every string sits in a zone declared in
 * timeline-layouts.ts and is fits-in-rect tested.
 */
function FigureSvg({ layout, className }: { layout: FigureLayout; className?: string }) {
  const d = staleViewFigure;
  const z = layout.zones;
  const desktop = layout.kind === "desktop";

  const pPts = stairPoints(d.pchain.stair);
  const vPts = viewSeriesPoints(d.view);
  const af = d.view.alarmFrom;
  const hf = d.view.healFrom;
  /* The three spans are disjoint and share only their boundary points, so
     paint order is never load-bearing: ink up to the freeze riser's base,
     alarm through the plateau, ink again from the unlock riser upward. */
  const upToFirst = (pts: readonly (readonly [number, number])[], x: number) => {
    const i = pts.findIndex((p) => p[0] === x);
    return i >= 0 ? pts.slice(0, i + 1) : pts;
  };
  const pre = af !== undefined ? upToFirst(vPts.filter((p) => p[0] <= af), af) : vPts;
  const alarm =
    af !== undefined
      ? upToFirst(
          vPts.filter((p) => p[0] >= af && (hf === undefined || p[0] <= hf)),
          hf ?? 1,
        )
      : [];
  const heal = hf !== undefined ? vPts.filter((p) => p[0] >= hf) : [];

  const swatch = legendSwatch(layout);
  const textInset = swatch + 10;
  const legendBase1 = z.legend1.y + (desktop ? 13 : 12);
  const legendBase2 = z.legend2.y + (desktop ? 13 : 12);
  const legendBase3 = z.legend3.y + (desktop ? 13 : 10);
  const glyphY = legendBase3 - (desktop ? 3.5 : 3);
  const mark = glossaryMark(layout);

  const blockSize = desktop ? 5 : 4;
  const skipArm = desktop ? 4 : 3;

  const gapX = mapX(layout, d.dim.atX);
  const gapTop = mapY(layout, seriesYAt(pPts, d.dim.atX));
  const gapBot = mapY(layout, seriesYAt(vPts, d.dim.atX));

  const regX = d.pchain.registrationAt !== undefined ? mapX(layout, d.pchain.registrationAt) : undefined;
  const regY =
    d.pchain.registrationAt !== undefined
      ? mapY(layout, seriesYAt(pPts, d.pchain.registrationAt))
      : undefined;

  const wordZones = [z.w1, z.w2, z.w3];

  return (
    <svg
      viewBox={`0 0 ${layout.viewBox.w} ${layout.viewBox.h}`}
      role="img"
      aria-label="One incident on the ProposerVM view: the L1's embedded view climbs with the P-Chain, freezes for 42 days while the P-Chain keeps climbing and proposer slots skip, then one registration and one block heal it."
      className={className}
      style={{ fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)" }}
    >
      {/* legend: both lines named, every mark explained */}
      <path d={`M${z.legend1.x + 2} ${legendBase1 - 4} h${swatch}`} stroke={STEEL} strokeWidth={2} />
      <text x={z.legend1.x + textInset} y={legendBase1} fontSize={z.legend1.fontPx} fontWeight={600} className={SOFT_FILL} style={{ letterSpacing: `${z.legend1.trackingEm}em` }}>
        {LEGEND_LINE_1}
      </text>
      <path d={`M${z.legend2.x + 2} ${legendBase2 - 4} h${swatch}`} strokeWidth={2.5} fill="none" className={INK_STROKE} />
      <text x={z.legend2.x + textInset} y={legendBase2} fontSize={z.legend2.fontPx} fontWeight={600} className={SOFT_FILL} style={{ letterSpacing: `${z.legend2.trackingEm}em` }}>
        {LEGEND_LINE_2}
      </text>
      {markGlossary(layout).map((entry) => (
        <g key={entry.glyph}>
          {entry.glyph === "block" ? (
            <rect x={entry.cx - mark} y={glyphY - mark} width={2 * mark} height={2 * mark} fill={ACCENT} />
          ) : null}
          {entry.glyph === "registration" ? (
            <path
              d={`M${entry.cx} ${glyphY - mark - 1} l${mark + 1} ${mark + 1} l${-(mark + 1)} ${mark + 1} l${-(mark + 1)} ${-(mark + 1)} Z`}
              fill={ACCENT}
            />
          ) : null}
          {entry.glyph === "skip" ? (
            <path
              d={`M${entry.cx - mark} ${glyphY - mark} l${2 * mark} ${2 * mark} m0 ${-2 * mark} l${-2 * mark} ${2 * mark}`}
              strokeWidth={1.4}
              fill="none"
              className={FAINT_STROKE}
            />
          ) : null}
          <text x={entry.textX} y={legendBase3} fontSize={z.legend3.fontPx} className={MUTE_FILL} style={{ letterSpacing: `${z.legend3.trackingEm}em` }}>
            {entry.label}
          </text>
        </g>
      ))}

      {/* the two series: P-Chain, then view pre / alarm / heal */}
      <path d={seriesPath(layout, pPts)} stroke={STEEL} strokeWidth={2} fill="none" />
      {pre.length > 1 ? (
        <path d={seriesPath(layout, pre)} strokeWidth={2.5} fill="none" className={INK_STROKE} />
      ) : null}
      {alarm.length > 1 ? (
        <path d={seriesPath(layout, alarm)} stroke={ACCENT} strokeWidth={2.5} fill="none" />
      ) : null}
      {heal.length > 1 ? (
        <path d={seriesPath(layout, heal)} strokeWidth={2.5} fill="none" className={INK_STROKE} />
      ) : null}

      {/* marks: produced blocks, skipped slots, the registration */}
      {d.view.blocks.map((bx) => (
        <rect
          key={`b-${bx}`}
          x={mapX(layout, bx) - blockSize}
          y={mapY(layout, seriesYAt(vPts, bx)) - blockSize}
          width={2 * blockSize}
          height={2 * blockSize}
          fill={ACCENT}
        />
      ))}
      {(d.view.skips ?? []).map((sx) => {
        const cx = mapX(layout, sx);
        const cy = mapY(layout, seriesYAt(vPts, sx));
        return (
          <path
            key={`s-${sx}`}
            d={`M${cx - skipArm} ${cy - skipArm} l${2 * skipArm} ${2 * skipArm} m0 ${-2 * skipArm} l${-2 * skipArm} ${2 * skipArm}`}
            strokeWidth={1.4}
            fill="none"
            className={FAINT_STROKE}
          />
        );
      })}
      {regX !== undefined && regY !== undefined ? (
        <path d={`M${regX} ${regY - 7} l7 7 l-7 7 l-7 -7 Z`} fill={ACCENT} />
      ) : null}

      {/* the one red gap dimension */}
      <path d={`M${gapX} ${gapTop} v${gapBot - gapTop}`} stroke={ACCENT} strokeWidth={1} />
      <path
        d={`M${gapX - 3} ${gapTop + 6} l3 -6 l3 6 M${gapX - 3} ${gapBot - 6} l3 6 l3 -6`}
        stroke={ACCENT}
        strokeWidth={1}
        fill="none"
      />
      <text x={z.dimL.x + 4} y={z.dimL.y + (desktop ? 15 : 12)} fontSize={z.dimL.fontPx} fontWeight={600} fill={ACCENT} style={{ letterSpacing: `${z.dimL.trackingEm}em` }}>
        {desktop ? d.dim.label : d.dim.labelMobile}
      </text>

      {/* axis, boundary ticks, phase words */}
      <path d={`M${layout.plot.x0} ${layout.axisY} H${layout.plot.x1}`} strokeWidth={1} fill="none" className={FAINT_STROKE} />
      {d.phases.map((ph, i) => {
        const zoneW = wordZones[i];
        const mid = zoneW.x + zoneW.w / 2;
        const alarmTone = ph.tone === "alarm";
        return (
          <g key={ph.label}>
            {ph.to < 1 ? (
              <path d={`M${mapX(layout, ph.to)} ${layout.axisY - 4} v8`} strokeWidth={1} fill="none" className={FAINT_STROKE} />
            ) : null}
            <text
              x={mid}
              y={zoneW.y + (desktop ? 13 : 11)}
              fontSize={zoneW.fontPx}
              fontWeight={alarmTone ? 600 : 400}
              textAnchor="middle"
              fill={alarmTone ? ACCENT : undefined}
              className={alarmTone ? "" : MUTE_FILL}
              style={{ letterSpacing: `${zoneW.trackingEm}em` }}
            >
              {ph.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function StaircaseFigure() {
  return (
    <figure className="not-prose my-8 w-full">
      <FigureSvg layout={figureDesktop} className="hidden w-full sm:block" />
      <FigureSvg layout={figureMobile} className="w-full sm:hidden" />
      <figcaption className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        One incident, start to finish: the shape of the worked example below. Time compressed, not
        to scale; all numbers illustrative.
      </figcaption>
    </figure>
  );
}
