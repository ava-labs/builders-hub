/* The stack drawing's layout, with no three.js: the scene frames itself
   with it, and the page draws the drawing's link areas from it, so a link
   area sits on what it names in the canvas and in the stills. */

export const SIDE = 3;
export const THICK = 0.3;
export const GAP_SHUT = 0.04;
// the least open gap: a narrow box opens the stack wider, so its labels keep their pitch
export const GAP_OPEN = 0.7;
export const LIFT = 0.24;
export const PLATE_Y = -0.62;
export const PLATE_T = 0.08;
export const PLATE = SIDE + 1.8;

// the camera sits at target + VIEW. On screen, right is (1, 0, -1) / sqrt 2
// and up is (-UP_XZ, UP_Y, -UP_XZ)
export const VIEW: [number, number, number] = [10, 8.2, 10];
const VIEW_LEN = Math.hypot(...VIEW);
export const UP_Y = Math.hypot(VIEW[0], VIEW[2]) / VIEW_LEN;
const UP_XZ = VIEW[1] / VIEW_LEN / Math.SQRT2;

// the label column in px (pl-3, the w-12 rule, gap-3, the w-56 text) plus air at the box edge
const LABEL_TEXT_X = 12 + 48 + 12;
const LABEL_TEXT_W = 224;
const LABEL_PX = LABEL_TEXT_X + LABEL_TEXT_W + 8;
// a label is two lines, about 54 px tall; open, the labels sit LABEL_PITCH px apart
export const LABEL_H = 54;
export const LABEL_PITCH = 64;
// air around the drawing, in units
const MARGIN = 0.25;

// screen extents in units from the origin: across, the plate's left corner
// and the layers' right corner (where the labels hang); up, the plate's
// front corner (lowest) and the top layer's back corner, lifted (highest)
const PLATE_R = PLATE / Math.SQRT2;
const ANCHOR_R = SIDE / Math.SQRT2;
const BOTTOM_U = -UP_XZ * PLATE + UP_Y * (PLATE_Y - PLATE_T / 2);
const topU = (count: number, gap: number) => UP_XZ * SIDE + UP_Y * ((count - 1) * (THICK + gap) + THICK / 2 + LIFT);

export interface Framing {
  zoom: number;
  /** the open gap for this box */
  gap: number;
  target: [number, number, number];
}

/** fit the whole plate, and the labels when there are any, in a box of width x height px */
export function frameFor(width: number, height: number, count: number, labels: boolean): Framing {
  // the drawing's height in units, with its margin, at an open gap
  const tall = (gap: number) => topU(count, gap) - BOTTOM_U + 2 * MARGIN;
  const wide = PLATE_R + MARGIN + (labels ? ANCHOR_R : PLATE_R + MARGIN);
  const room = labels ? width - LABEL_PX : width;
  let zoom = Math.min(room / wide, height / tall(GAP_OPEN));
  // the labels need LABEL_PITCH px between layers: a small zoom opens the
  // gap past GAP_OPEN, and this bound keeps that taller stack in the box
  if (labels) zoom = Math.min(zoom, (height - (count - 1) * LABEL_PITCH) / tall(-THICK));
  zoom = Math.max(zoom, 1);
  const gap = labels ? Math.max(GAP_OPEN, LABEL_PITCH / (UP_Y * zoom) - THICK) : GAP_OPEN;
  // across: spare px split evenly at the two ends; alone, the plate is centered
  const spare = room - wide * zoom;
  const right = labels ? width / (2 * zoom) - (PLATE_R + MARGIN) - spare / (2 * zoom) : 0;
  // up: halfway between the lowest and the highest point
  const up = (topU(count, gap) + BOTTOM_U) / 2;
  return { zoom, gap, target: [right / Math.SQRT2, up / UP_Y, -right / Math.SQRT2] };
}

export interface StackAreas {
  /** each layer's outline as drawn, bottom first, as SVG points in px */
  layers: string[];
  /** the plate's outline, as SVG points in px */
  plate: string;
  /** each label's text box in px, bottom first; empty when the drawing has no labels */
  labels: { x: number; y: number; width: number; height: number }[];
}

/** a point in the drawing to px in the box, at rest (the stack open, the rig unturned) */
function toBox(width: number, height: number, { zoom, target }: Framing, [x, y, z]: number[]): [number, number] {
  const dx = x - target[0];
  const dy = y - target[1];
  const dz = z - target[2];
  const right = (dx - dz) / Math.SQRT2;
  const up = -UP_XZ * dx + UP_Y * dy - UP_XZ * dz;
  return [width / 2 + zoom * right, height / 2 - zoom * up];
}

/** the outline of a box centered at (0, cy, 0): the hull of its eight corners on screen */
function outline(width: number, height: number, framing: Framing, side: number, thick: number, cy: number): string {
  const h = side / 2;
  const corners: [number, number][] = [];
  for (const x of [-h, h]) for (const y of [cy - thick / 2, cy + thick / 2]) for (const z of [-h, h]) {
    corners.push(toBox(width, height, framing, [x, y, z]));
  }
  // the monotone chain hull, so the points run around the outline once
  corners.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (pts: [number, number][]) => {
    const out: [number, number][] = [];
    for (const p of pts) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  const hull = [...half(corners), ...half([...corners].reverse())];
  return hull.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

/**
 * Where the plate, each layer and each label sit in a box of width x height
 * px, the stack open and the rig unturned. `lifted` is the layer drawn
 * lifted, as the stills show the lit validator set; null draws every layer
 * at its rest place, where the canvas keeps its hover targets.
 */
export function stackAreas(
  width: number,
  height: number,
  count: number,
  labels: boolean,
  lifted: number | null,
): StackAreas {
  const framing = frameFor(width, height, count, labels);
  const step = THICK + framing.gap;
  const layers = Array.from({ length: count }, (_, i) =>
    outline(width, height, framing, SIDE, THICK, i * step + (i === lifted ? LIFT : 0)),
  );
  return {
    layers,
    plate: outline(width, height, framing, PLATE, PLATE_T, PLATE_Y),
    // a label hangs from its layer's right corner, centered on it. Its text
    // opens the layer, as in the canvas; the leader rule crosses the plate,
    // which keeps its clicks there
    labels: labels
      ? Array.from({ length: count }, (_, i) => {
          const [x, y] = toBox(width, height, framing, [SIDE / 2, i * step, -SIDE / 2]);
          return { x: x + LABEL_TEXT_X, y: y - LABEL_H / 2, width: LABEL_TEXT_W, height: LABEL_H };
        })
      : [],
  };
}
