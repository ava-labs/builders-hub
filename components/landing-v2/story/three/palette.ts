import { BoxGeometry, Color, Float32BufferAttribute, SRGBColorSpace } from "three";

/* The story scenes' colors, per page theme. Brand tokens only: red #E6212F
   marks the one thing the scene is about; steel and slate carry the
   structure. Faces are flat, shaded in three fixed tones like an isometric
   drawing (top lightest, left mid, right darkest), not by lights, so the
   form reads the same on every screen. A hairline draws every edge. */

export type SceneTheme = "light" | "dark";

export interface ScenePalette {
  /** a block's top face; the sides are this tone times SHADE */
  face: string;
  /** the hairline on every block edge */
  edge: string;
  /** the ground plate the chains stand on (the P-Chain) */
  plate: string;
  /** grid lines on the plate */
  grid: string;
  /** the quiet hairline: a route between two chains */
  route: string;
  /** the brand red: the lit layer, a message in flight */
  red: string;
  /** a red block's hairline */
  redEdge: string;
  /** label ink */
  ink: string;
  /** the P-Chain's name on its plate: a step quieter than a chain's name */
  plateInk: string;
  /** multiplies a chain's logo disc: white marks are the brightest thing on a dark page, so a step down there */
  mark: string;
}

export const PALETTE: Record<SceneTheme, ScenePalette> = {
  light: {
    face: "#eef1f3",
    edge: "#8e9a9e",
    plate: "#f6f7f8",
    grid: "#e2e6e8",
    route: "#c3cbce",
    red: "#e6212f",
    redEdge: "#9e1019",
    ink: "#3b484b",
    plateInk: "#66727a",
    mark: "#ffffff",
  },
  dark: {
    face: "#3a4145",
    edge: "#66747a",
    plate: "#16191b",
    grid: "#262b2e",
    route: "#4a555a",
    red: "#e6212f",
    redEdge: "#ff6b75",
    ink: "#a2afb2",
    plateInk: "#7d8a8f",
    mark: "#d5dadc",
  },
};

/** light on each visible face, as a share of the top: top, left (+z), right (+x).
    A light page wants a soft fall-off; a dark page needs a deeper one to read */
export const SHADE: Record<SceneTheme, { top: number; left: number; right: number }> = {
  light: { top: 1, left: 0.93, right: 0.84 },
  dark: { top: 1, left: 0.78, right: 0.6 },
};

/**
 * A box whose vertex colors carry the drawing's three tones. Multiply by a
 * material color (meshBasicMaterial with vertexColors) to tint it: the same
 * geometry draws a steel block or a red one.
 */
export function shadedBox(theme: SceneTheme, w = 1, h = 1, d = 1): BoxGeometry {
  const shade = SHADE[theme];
  const g = new BoxGeometry(w, h, d);
  const normal = g.getAttribute("normal");
  const colors: number[] = [];
  const c = new Color();
  for (let i = 0; i < normal.count; i++) {
    const nx = normal.getX(i);
    const ny = normal.getY(i);
    const nz = normal.getZ(i);
    const k = ny > 0.5 ? shade.top : nz > 0.5 ? shade.left : nx > 0.5 ? shade.right : 0.5;
    // the factor is perceptual: convert it to the linear working space
    c.setRGB(k, k, k, "srgb");
    colors.push(c.r, c.g, c.b);
  }
  g.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return g;
}

/** how far a chain's own color is held in, per page theme: saturation cap, lightness band, then a step toward the face tone */
const BRAND: Record<SceneTheme, { s: number; l: [number, number]; toFace: number }> = {
  light: { s: 0.35, l: [0.55, 0.68], toFace: 0.4 },
  dark: { s: 0.28, l: [0.38, 0.5], toFace: 0.35 },
};
const RED_HUE = new Color(PALETTE.light.red).getHSL({ h: 0, s: 0, l: 0 }, SRGBColorSpace).h;

/**
 * A chain's own color (a logo's dominant color), set to sit calmly on the
 * page: its hue kept, its saturation and lightness held in, then a short
 * step toward the steel face, so a plate of brands still reads as one
 * drawing. A color near the brand red returns null, so the block keeps the
 * steel face: red marks the messages, and a red block would hide them.
 */
export function brandTone(color: Color, theme: SceneTheme): Color | null {
  const hsl = color.getHSL({ h: 0, s: 0, l: 0 }, SRGBColorSpace);
  const off = Math.abs(hsl.h - RED_HUE);
  if (Math.min(off, 1 - off) < 0.045 && hsl.s > 0.35) return null;
  const k = BRAND[theme];
  const out = new Color().setHSL(hsl.h, Math.min(hsl.s, k.s), Math.min(Math.max(hsl.l, k.l[0]), k.l[1]), SRGBColorSpace);
  return out.lerp(new Color(PALETTE[theme].face), k.toFace);
}
