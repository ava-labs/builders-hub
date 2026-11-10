import type { ReactNode } from 'react';
import type { TermRole } from '@/components/docs-book/term';
import { endOf, outline, type Point, type Track } from './geometry';

/*
 * Parts of a flow figure. The hatched band is the thing that moves (fees, blocks, messages). An empty steel
 * outline of the same width is a path that the band can take but does not take now. Every color comes from the
 * docs tokens through currentColor, and a colored part sits in an element with data-bk-role, so the color key
 * switch turns it to ink. Every color also has a shape and a word (Marker, FlowLabel).
 */

/** The side of the edge of a marker, in user units. */
export const MARK = 10;

/** A hollow square is a validator setting, a filled square a contract or an account on the L1, a crossed square a burn. */
export type MarkerKind = 'setting' | 'account' | 'burn';

export function Marker({ kind, x, y }: { kind: MarkerKind; x: number; y: number }) {
  if (kind === 'account') return <rect x={x} y={y} width={MARK} height={MARK} fill="currentColor" />;
  // Inset the outline by half its stroke, so that all three markers fill the same square.
  const box = (
    <rect
      x={x + 0.75}
      y={y + 0.75}
      width={MARK - 1.5}
      height={MARK - 1.5}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    />
  );
  if (kind === 'setting') return box;
  return (
    <g>
      {box}
      <path d={`M${x + 3} ${y + 3} l4 4 m0 -4 l-4 4`} fill="none" stroke="currentColor" strokeWidth={1.25} />
    </g>
  );
}

/** Set each address in a line in the code face, as in the prose. */
export function Words({ text }: { text: string }) {
  return text.split(/(0x[0-9a-f]+…[0-9a-f]+)/i).map((part, i) =>
    i % 2 ? (
      <tspan key={part} className="bk-flow-code">
        {part}
      </tspan>
    ) : (
      part
    ),
  );
}

/** Fine diagonal hatching for a band, as in an engraving. It scales with the drawing. Put it in <defs>. */
export function HatchPattern({ id }: { id: string }) {
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width={3.5} height={3.5} patternTransform="rotate(45)">
      <line className="bk-fig-ink2" x1={1.75} y1={0} x2={1.75} y2={3.5} stroke="currentColor" strokeWidth={0.75} />
    </pattern>
  );
}

/** The band: a hatched channel with an ink outline, and a bar across its end unless `cap` is false. */
export function Band({ track, half, hatch, cap = true }: { track: Track; half: number; hatch: string; cap?: boolean }) {
  const { at, heading } = endOf(track);
  return (
    <g>
      <path d={outline(track, half, true)} fill={`url(#${hatch})`} />
      <path d={outline(track, half)} fill="none" stroke="currentColor" />
      {cap && (
        <rect
          x={at[0]}
          y={at[1] - half - 4}
          width={3}
          height={2 * half + 8}
          fill="currentColor"
          transform={heading % 360 === 0 ? undefined : `rotate(${heading} ${at[0]} ${at[1]})`}
        />
      )}
    </g>
  );
}

/**
 * Channels that branch from one root. The empty ones are steel hairlines, and each one hides its edges where it
 * runs inside another channel, so the fork shows one clean outline and not crossed ones. The active channel is
 * the band. `id` must be unique on the page: use the figure name and the layout name.
 */
export function Fork({
  id,
  tracks,
  half,
  active,
  hatch,
  size: [w, h],
}: {
  id: string;
  tracks: readonly Track[];
  half: number;
  active: number | null;
  hatch: string;
  size: Point;
}) {
  // Inset the mask shapes a little, so that a hairline on the shared edge at the root stays visible.
  const inner = tracks.map((t) => outline(t, half - 0.6, true));
  return (
    <g>
      <defs>
        {/* White and black are mask values, not colors on screen. */}
        {tracks.map((_, i) =>
          i === active ? null : (
            <mask key={i} id={`${id}-mask-${i}`} maskUnits="userSpaceOnUse" x={-20} y={-20} width={w + 40} height={h + 40}>
              <rect x={-20} y={-20} width={w + 40} height={h + 40} fill="white" />
              {inner.map((d, j) => (j === i ? null : <path key={j} d={d} fill="black" />))}
            </mask>
          ),
        )}
      </defs>
      {tracks.map((t, i) =>
        i === active ? null : (
          <path
            key={i}
            className="bk-fig-steel"
            d={outline(t, half)}
            mask={`url(#${id}-mask-${i})`}
            fill="none"
            stroke="currentColor"
          />
        ),
      )}
      {active !== null && <Band track={tracks[active]} half={half} hatch={hatch} />}
    </g>
  );
}

/** One empty channel: a steel hairline outline of the band's width. */
export function Channel({ track, half }: { track: Track; half: number }) {
  return <path className="bk-fig-steel" d={outline(track, half)} fill="none" stroke="currentColor" />;
}

export interface FlowLabelProps {
  /** The left end of the label, at the center line of its channel. */
  at: Point;
  name: string;
  /** A quiet word after the name, such as "default". */
  tag?: string;
  marker?: MarkerKind;
  role?: TermRole;
  /** A config key or a method, in the code face, under the name. */
  code?: string;
  /** Short lines of prose under the name. Addresses in them take the code face. */
  lines?: readonly string[];
}

/** A label: the marker and the name level with the channel, then a code line and short lines of prose. */
export function FlowLabel({ at: [x, cy], name, tag, marker, role, code, lines = [] }: FlowLabelProps) {
  const base = cy + 5;
  const head = (
    <g>
      {marker && <Marker kind={marker} x={x} y={base - MARK} />}
      <text className="bk-flow-name" x={marker ? x + MARK + 8 : x} y={base}>
        {name}
        {tag && (
          <tspan className="bk-flow-tag" dx={10}>
            {tag}
          </tspan>
        )}
      </text>
    </g>
  );
  const first = base + (code ? 40 : 22);
  return (
    <g>
      {role ? <g data-bk-role={role}>{head}</g> : head}
      {code && (
        <text className="bk-fig-code bk-fig-ink2" x={x} y={base + 20}>
          {code}
        </text>
      )}
      {lines.map((line, j) => (
        <text key={line} className="bk-fig-sans bk-fig-ink2" x={x} y={first + j * 17}>
          <Words text={line} />
        </text>
      ))}
    </g>
  );
}

/**
 * One drawing of a flow figure. A figure has a wide drawing (at most 720 units, shown in a column of 660px or
 * more) and a stacked one (at most 340 units, for phones). Each keeps its smallest text (12 units) at 11px or more
 * on screen. The label describes the whole figure for a screen reader, the same in both drawings.
 */
export function FlowSvg({
  layout,
  size: [w, h],
  label,
  children,
}: {
  layout: 'wide' | 'stacked';
  size: Point;
  label: string;
  children: ReactNode;
}) {
  return (
    <svg data-layout={layout} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      {children}
    </svg>
  );
}

/** The frame of a flow figure: figure.css shows the wide or the stacked drawing for the width of the column. */
export function FlowArt({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div data-bk-figure-art={name} data-bk-flow="">
      {children}
    </div>
  );
}
