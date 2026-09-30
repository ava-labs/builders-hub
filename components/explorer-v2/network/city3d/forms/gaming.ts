import type { Node } from "@/components/explorer-v2/network/icm-map";
import { diceOf } from "@/components/explorer-v2/network/city-geometry";
import { boxAt, boxPart, dropAt, planAt, shapeAt, YAW, type FormPart, type Plan, type Roll } from "./frame";

/* Gaming builds in sheared prisms: glass towers whose tops are cut on a
   steep slant, the slant glazed, as the late modern towers of the 1970s
   were. The slant takes the front half of the roof, falling to the lit
   face or to the other front face, and the back half is a flat deck at
   the set's height, whose front edge, the slant's head, carries the
   plaque. A landmark of the skyline stands slimmer, and carries the
   landmark's mast and white light off its deck, as the city's others do. */

export function gamingPlan(n: Node, roll: Roll, landmark: boolean): Plan {
  const { w, h } = n;
  const H = w / Math.SQRT2;
  // the slant falls along u (to the right face) or along v (to the lit face)
  const alongV = roll() < 0.5;
  const slim = landmark ? 0.82 : roll() < 0.5 ? 0.9 : 0.78;
  const Hs = H * slim;
  const Ht = H * (landmark ? 0.82 : 0.9);
  const rise = Math.min(h * (0.22 + roll() * 0.1), Hs * 1.5);
  const box = (hs: number, ht: number, z0: number, z1: number, s = 0, glass?: FormPart["glass"]) => (alongV ? boxPart(ht, hs, z0, z1, 0, s, glass) : boxPart(hs, ht, z0, z1, s, 0, glass));
  const parts: FormPart[] = [box(Hs, Ht, 0, h - rise), box(Hs / 2, Ht, h - rise, h, -Hs / 2)];
  // the drone lands on the deck's front corner, beside the plaque on the slant's head and clear of the landmark's mast
  const ringG = Math.min(Hs * 0.25, 2.4);
  const [du, dv] = alongV ? [Ht - ringG - 0.3, -ringG - 0.3] : [-ringG - 0.3, Ht - ringG - 0.3];
  return {
    parts,
    crest: h,
    extent: w * 1.05,
    shaft: 0,
    drop: dropAt(du, dv, h, ringG),
    dress(m, bd, b) {
      // the wedge over the front half, and its glass laid on its slope from the low edge up, a hair off it
      const at = (s: number): [number, number] => (alongV ? [0, s] : [s, 0]);
      const turn = alongV ? Math.PI / 2 : Math.PI;
      const z0 = h - rise;
      const [cu, cv] = at(Hs / 2);
      m.shapes.saw.push(shapeAt(bd, b, cu, cv, z0, Hs, rise, 2 * Ht, turn));
      const len = Math.hypot(Hs, rise);
      const slope = Math.atan2(rise, Hs);
      const inset = len * 0.035;
      const lift = 0.06;
      const [gu, gv] = at(Hs - inset * Math.cos(slope) + lift * Math.sin(slope));
      const [wx, wz] = planAt(gu, gv);
      m.ribbons.push({ b, x: bd.x + wx, y: bd.base + z0 + inset * Math.sin(slope) + lift * Math.cos(slope), z: bd.z + wz, sx: 2 * Ht * 0.86, sy: len * 0.93, sz: 1, yaw: YAW + (alongV ? 0 : Math.PI / 2), pitch: -(Math.PI / 2 - slope), k: -1, tone: "top" });
      // the deck's parapet, and the landmark's mast off its back, with its white light, as the model's, short enough for the pick to hold
      const [pu, pv] = at(-Hs / 2);
      m.shapes.trim.push(boxAt(bd, b, pu, pv, (alongV ? Ht : Hs / 2) + 0.3, (alongV ? Hs / 2 : Ht) + 0.3, h - 0.6, h));
      if (landmark) {
        const [mu, mv] = at(-Hs * 0.62);
        m.steel.push(boxAt(bd, b, mu, mv, 0.21, 0.21, h, h + 14));
        const [mx, mz] = planAt(mu, mv);
        m.lamps.push({ b, x: bd.x + mx, y: bd.base + h + 14.7, z: bd.z + mz, r: 1.05, white: true, beat: 3.2, phase: diceOf(`${bd.id}:spire`)() * 3.2 });
      }
    },
  };
}
