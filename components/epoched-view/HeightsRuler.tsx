import {
  RULER_FOOTER,
  RULER_NAMES,
  RULER_ROLES,
  RULER_VALUES,
  rulerDesktop,
  rulerMobile,
  type RulerLayout,
  type RulerMark,
} from "./timeline-layouts";

const STEEL = "#A2AFB2";

const INK_FILL = "fill-zinc-900 dark:fill-zinc-100";
const INK_STROKE = "stroke-zinc-900 dark:stroke-zinc-100";
const SOFT_FILL = "fill-zinc-600 dark:fill-zinc-300";
const SOFT_STROKE = "stroke-zinc-600 dark:stroke-zinc-300";
const MUTE_FILL = "fill-zinc-500 dark:fill-zinc-400";
const FAINT_FILL = "fill-zinc-400 dark:fill-zinc-600";
const FAINT_STROKE = "stroke-zinc-400 dark:stroke-zinc-600";

const MARKS: readonly RulerMark[] = ["epoch", "tip", "live"];

/**
 * The heights ruler (round 3.3): the three P-Chain heights of the worked
 * example's Bridge-block row on one axis, ordered epoch <= tip <= live.
 * Zero motion; every string sits in a zone declared in timeline-layouts.ts
 * and is fits-in-rect tested.
 */
function RulerSvg({ layout, className }: { layout: RulerLayout; className?: string }) {
  const z = layout.zones;
  const desktop = layout.kind === "desktop";
  const sq = desktop ? 6 : 5;
  const cap = (k: RulerMark): string => k.charAt(0).toUpperCase() + k.slice(1);

  return (
    <svg
      viewBox={`0 0 ${layout.viewBox.w} ${layout.viewBox.h}`}
      role="img"
      aria-label="The three P-Chain heights at the worked example's Bridge-block row: the epoch pins 291,012 for warp verification, the tip embeds 302,168 which sets who may build, and the live registry is at 302,171. The order is always epoch height, then tip embeds, then P-Chain height."
      className={className}
      style={{ fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)" }}
    >
      {/* axis with climbing arrowhead and the 42-day break */}
      <path d={`M${layout.axisX0} ${layout.axisY} H${layout.axisX1 - 10}`} strokeWidth={1} fill="none" className={FAINT_STROKE} />
      <path
        d={`M${layout.axisX1 - 10} ${layout.axisY - 4} L${layout.axisX1} ${layout.axisY} L${layout.axisX1 - 10} ${layout.axisY + 4} Z`}
        className={FAINT_FILL}
      />
      <path
        d={`M${layout.marks.brk - 6} ${layout.axisY + 7} l8 -14 m-2 14 l8 -14`}
        strokeWidth={1.6}
        fill="none"
        className={SOFT_STROKE}
      />

      {/* markers: hollow square (epoch), filled square (tip), steel dot (live) */}
      <rect
        x={layout.marks.epoch - sq}
        y={layout.axisY - sq}
        width={2 * sq}
        height={2 * sq}
        strokeWidth={2}
        fill="none"
        className={INK_STROKE}
      />
      <rect
        x={layout.marks.tip - sq}
        y={layout.axisY - sq}
        width={2 * sq}
        height={2 * sq}
        className={INK_FILL}
      />
      <circle cx={layout.marks.live} cy={layout.axisY} r={desktop ? 5 : 4} fill={STEEL} />
      {MARKS.map((k) => (
        <path
          key={`t-${k}`}
          d={`M${layout.marks[k]} ${layout.axisY + sq + 2} v8`}
          strokeWidth={1}
          strokeDasharray="2 3"
          fill="none"
          className={FAINT_STROKE}
        />
      ))}

      {/* names, roles (desktop only), values */}
      {MARKS.map((k) => {
        const nz = z[`n${cap(k)}`];
        const rz = z[`r${cap(k)}`];
        const vz = z[`v${cap(k)}`];
        return (
          <g key={k}>
            <text
              x={nz.x + nz.w / 2}
              y={nz.y + (desktop ? 13 : 11)}
              fontSize={nz.fontPx}
              fontWeight={600}
              textAnchor="middle"
              className={SOFT_FILL}
              style={{ letterSpacing: `${nz.trackingEm}em` }}
            >
              {RULER_NAMES[k]}
            </text>
            {desktop && rz ? (
              <text x={rz.x + rz.w / 2} y={rz.y + 11} fontSize={rz.fontPx} textAnchor="middle" className={MUTE_FILL}>
                {RULER_ROLES[k]}
              </text>
            ) : null}
            <text
              x={vz.x + vz.w / 2}
              y={vz.y + (desktop ? 16 : 14)}
              fontSize={vz.fontPx}
              fontWeight={600}
              textAnchor="middle"
              className={INK_FILL}
            >
              {RULER_VALUES[k]}
            </text>
          </g>
        );
      })}

      {/* the ordering law */}
      <text
        x={z.footer.x + z.footer.w / 2}
        y={z.footer.y + (desktop ? 13 : 11)}
        fontSize={z.footer.fontPx}
        textAnchor="middle"
        className={MUTE_FILL}
        style={{ letterSpacing: `${z.footer.trackingEm}em` }}
      >
        {RULER_FOOTER}
      </text>
    </svg>
  );
}

export function HeightsRuler() {
  return (
    <figure className="not-prose my-6 w-full">
      <RulerSvg layout={rulerDesktop} className="hidden w-full sm:block" />
      <RulerSvg layout={rulerMobile} className="w-full sm:hidden" />
      <figcaption className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        The three heights at the table&rsquo;s Bridge block row.
      </figcaption>
    </figure>
  );
}
