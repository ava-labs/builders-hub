import type { Node } from "@/components/explorer-v2/network/icm-map";
import { FLOOR, boxAt, boxPart, dropAt, facesOf, glassHalf, halvesOn, onFace, shapeAt, storeyAt, type FormPart, type Plan, type Roll } from "./frame";

/* Enterprise is the corporate headquarters of the International Style:
   curtain walls of glass, storey on storey, on a recessed glazed lobby
   under slim columns. A house either lifts a slab over a low bar, as
   Lever House does, or stands a single prism on its plaza with its steel
   mullions run up the glass, as the Seagram does; each wears a plain
   plant storey for a crown. */

const WALL = 4.4;

export function enterprisePlan(n: Node, roll: Roll): Plan {
  const { w, h } = n;
  const H = w / Math.SQRT2;
  const lever = roll() < 0.5;
  const lobby = storeyAt(1);
  const plant = h - 3.2;
  if (lever) {
    // the bar over the lobby, and the slab rising off one end of it, over the ground point, where the plaque stands
    const bar = Math.min(storeyAt(2), plant - FLOOR);
    const slab = -H * 0.36;
    const parts: FormPart[] = [
      boxPart(H - 1.8, H - 1.8, 0, lobby, 0, 0, { h: WALL }),
      boxPart(H, H, lobby, bar, 0, 0, { h: WALL }),
      boxPart(H * 0.46, H, bar, plant, slab, 0, { h: WALL }),
      boxPart(H * 0.42, H * 0.94, plant, h, slab, 0, { none: true }),
    ];
    return {
      parts,
      crest: h,
      extent: w * 1.05,
      shaft: 2,
      // the drone lands on the bar's roof, beside the slab
      drop: dropAt(H * 0.6, 0, bar, H * 0.4 - 0.4),
      dress(m, bd, b) {
        for (const f of facesOf(H, H)) {
          const g = H - 0.9;
          for (let i = 0; i <= 4; i++) {
            const [u, v] = onFace(f, -g + (2 * g * i) / 4, -0.9);
            m.shapes.column.push(shapeAt(bd, b, u, v, 0, 0.32, lobby, 0.32));
          }
        }
      },
    };
  }
  // the prism on its plaza: a lobby set in under it, its mullions run up the glass, a plant storey on top
  const Hp = H * 0.88;
  const parts: FormPart[] = [boxPart(Hp - 1.6, Hp - 1.6, 0, lobby, 0, 0, { h: WALL }), boxPart(Hp, Hp, lobby, plant, 0, 0, { h: WALL }), boxPart(Hp * 0.96, Hp * 0.96, plant, h, 0, 0, { none: true })];
  return {
    parts,
    crest: h,
    extent: w * 1.05,
    shaft: 1,
    // the drone lands on the plant storey's roof toward its right face, clear of the plaque
    drop: dropAt(H * 0.58, H * 0.18, h, H * 0.26 - 0.4),
    dress(m, bd, b) {
      for (const f of facesOf(Hp, Hp)) {
        const g = glassHalf(Hp, Hp, f);
        const bays = Math.max(4, Math.round((2 * g) / 2.2));
        for (let i = 0; i <= bays; i++) {
          const [u, v] = onFace(f, -g + (2 * g * i) / bays, 0.2);
          const [hu, hv] = halvesOn(f, 0.1, 0.2);
          m.shapes.trim.push(boxAt(bd, b, u, v, hu, hv, lobby, plant));
        }
        for (let i = 0; i <= 3; i++) {
          const [u, v] = onFace(f, -g + (2 * g * i) / 3, -0.8);
          m.shapes.column.push(shapeAt(bd, b, u, v, 0, 0.36, lobby, 0.36));
        }
      }
    },
  };
}
