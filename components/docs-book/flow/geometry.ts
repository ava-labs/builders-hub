/*
 * Geometry for flow figures. A channel is a center line of straight runs and arcs. The band or the outline of a
 * channel is the same line offset to each side, so it keeps one width through every bend. That is why the
 * channels are lines and arcs, and not Bezier curves.
 *
 * Units are SVG user units. Headings are degrees: 0 is east, and positive turns are clockwise on screen, because
 * y points down.
 */

export type Point = readonly [number, number];

/** A piece of a channel center line: a straight run, or an arc of radius `arc` that turns by `turn` degrees. */
export type Seg = { line: number } | { arc: number; turn: number };

export interface Track {
  from: Point;
  heading: number;
  segs: readonly Seg[];
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const rad = (deg: number) => (deg * Math.PI) / 180;
export const round = (n: number) => Math.round(n * 100) / 100;
export const fmt = ([x, y]: Point) => `${round(x)} ${round(y)}`;

/** The point at distance d to the right of a heading. With y down, the right of east is south. */
export function side([x, y]: Point, heading: number, d: number): Point {
  const a = rad(heading);
  return [x - d * Math.sin(a), y + d * Math.cos(a)];
}

interface Piece {
  to: Point;
  arc?: { r: number; sweep: 0 | 1 };
}

/*
 * Follow a center line and give the line at distance d to its right. Each arc of the offset line has the same
 * center as the arc of the center line, so the band keeps the same width through every bend.
 */
export function walk(t: Track, d: number): { start: Point; pieces: Piece[] } {
  let p = t.from;
  let h = t.heading;
  const pieces: Piece[] = [];
  for (const s of t.segs) {
    if ('line' in s) {
      p = [p[0] + s.line * Math.cos(rad(h)), p[1] + s.line * Math.sin(rad(h))];
      pieces.push({ to: side(p, h, d) });
    } else {
      const sign = Math.sign(s.turn);
      const center = side(p, h, sign * s.arc);
      h += s.turn;
      p = side(center, h, -sign * s.arc);
      pieces.push({ to: side(p, h, d), arc: { r: s.arc - sign * d, sweep: s.turn > 0 ? 1 : 0 } });
    }
  }
  return { start: side(t.from, t.heading, d), pieces };
}

/** The end of a track's center line, and the heading there. */
export function endOf(t: Track): { at: Point; heading: number } {
  const pieces = walk(t, 0).pieces;
  const heading = t.segs.reduce((h, s) => ('turn' in s ? h + s.turn : h), t.heading);
  return { at: pieces[pieces.length - 1].to, heading };
}

function draw(pieces: readonly Piece[]): string {
  return pieces
    .map((p) => (p.arc ? ` A${round(p.arc.r)} ${round(p.arc.r)} 0 0 ${p.arc.sweep} ${fmt(p.to)}` : ` L${fmt(p.to)}`))
    .join('');
}

/** The center line of a track as an open path, for a thin line or an arrow along a channel. */
export function centerLine(t: Track): string {
  const { start, pieces } = walk(t, 0);
  return `M${fmt(start)}${draw(pieces)}`;
}

/*
 * The outline of a channel: along the left edge, across the end, and back along the right edge. The start stays
 * open, because a channel starts at a junction, or because the band comes in from outside the drawing. With
 * close, the same path is a closed shape for the hatch and for the masks.
 */
export function outline(t: Track, half: number, close = false): string {
  const left = walk(t, -half);
  const right = walk(t, half);
  const back = right.pieces
    .map((p, i) => {
      const to = i === 0 ? right.start : right.pieces[i - 1].to;
      return p.arc ? ` A${round(p.arc.r)} ${round(p.arc.r)} 0 0 ${1 - p.arc.sweep} ${fmt(to)}` : ` L${fmt(to)}`;
    })
    .reverse()
    .join('');
  const end = right.pieces[right.pieces.length - 1].to;
  return `M${fmt(left.start)}${draw(left.pieces)} L${fmt(end)}${back}${close ? ' Z' : ''}`;
}

/**
 * An S bend: two arcs that move the channel sideways by `shift` over a run of `run`, and keep its heading. A
 * positive shift goes to the right of the heading.
 */
export function bend(shift: number, run: number): Seg[] {
  const turn = 2 * Math.atan(Math.abs(shift) / run);
  const r = run / (2 * Math.sin(turn));
  const deg = (Math.sign(shift) * turn * 180) / Math.PI;
  return [
    { arc: r, turn: deg },
    { arc: r, turn: -deg },
  ];
}
