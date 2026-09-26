import { FLOOR } from "@/components/explorer-v2/network/city-model";

/** the cut of the tower's corners at its foot and at its roof, as shares of its half-width */
export const HUB_CHAMFER = 0.1;
export const HUB_CHAMFER_TOP = 0.25;
/** its roof's width over its foot's */
export const HUB_TAPER = 0.84;
/** the mark's size over the tower's half-width: as large as the cut roof holds */
export const HUB_CROWN = 0.8;
/** the podium's height: the tower's first floor stands on it */
export const HUB_LOBBY = 20;
/** the forecourt's two steps: how far each one's corners reach over the tower's half-width, and each step's rise */
export const HUB_PLINTH = [1.82, 1.61] as const;
export const HUB_STEP = 1.6;
/** the podium's half-width over the tower's */
export const HUB_LOBBY_W = 1.6;

/** the crown's height: its triangles, over the last ribbons */
export const CROWN = 13;
/** how far a sky lobby stands back from the walls, as a share of the tower's half-width */
export const LOBBY_SET = 0.07;
/** how far a ribbon's ends stand in from its face's corners, in plan */
export const RIBBON_END = 1.8;
/** the forecourt's steps and the podium: their half-widths over the tower's, and their cuts */
export const STEPS = [2.2, 1.95];
export const STEP_CUT = 0.2;
export const PODIUM_CUT = 0.24;
/** the porch's half-width over the tower's, how far it stands out from the podium, and its ridge */
export const PORCH_W = 0.34;
export const PORCH_OUT = 5;
/** where the mast stands on the roof, right of its middle, over the tower's half-width */
const MAST_AT = 0.52;

type Pt2 = [number, number];
/* the tower's footprint in plan round its ground point: the city's
   square turned to the plate, half-width w, each corner cut by c, from
   its left side round its front to its back */
export function chamferOf(w: number, c = HUB_CHAMFER): Pt2[] {
  const a = w * (1 - c);
  const b = w * c;
  return [[-a, -b], [-a, b], [-b, a], [b, a], [a, b], [a, -b], [b, -a], [-b, -a]];
}
/** the faces the viewer sees, by their corners in chamferOf: the lit wall, the cut front face, the shaded wall */
export const HUB_FACES: [number, number][] = [
  [1, 2],
  [2, 3],
  [3, 4],
];
/* how far up the shaft a height is, from its foot on the podium to its roof */
const riseOf = (z: number, h: number) => Math.max(0, Math.min(1, (z - HUB_LOBBY) / Math.max(1, h - HUB_LOBBY)));
/** the tower's width at a height, over its foot's */
export const hubScale = (z: number, h: number) => 1 - (1 - HUB_TAPER) * riseOf(z, h);
/** the cut of its corners at a height: chamferOf(w * hubScale(z, h), hubChamfer(z, h)) is its plan there */
export const hubChamfer = (z: number, h: number) => HUB_CHAMFER + (HUB_CHAMFER_TOP - HUB_CHAMFER) * riseOf(z, h);
/** the storeys the sky lobbies take, at a third and two thirds of its height */
export const hubLobbies = (h: number): [number, number] => [Math.round(h / 3 / FLOOR) + 1, Math.round((h * 2) / 3 / FLOOR)];

/** where downtown's mast stands on its roof, on screen: by the roof's right corner, clear of the mark */
export function hubMast(x: number, y: number, h: number, w: number): [number, number] {
  return [x + MAST_AT * w, y - h];
}
