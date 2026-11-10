import type { Node } from "@/components/explorer-v2/network/icm-map";
import { FLOOR, boxAt, boxPart, dropAt, pickReach, type FormPart, type Plan } from "./frame";

/* Infrastructure is the data warehouse: long, low data halls, their walls
   louvered storey by storey between slots of glass, rows of cooling units
   on the roof. A set that stands taller stacks its halls, about three
   storeys each, a set-in plant floor between two. */

/** a hall's slot of glass, a storey's middle; the louvers take the wall between two */
const SLOT_H = 2.2;

export function hallPlan(n: Node): Plan {
  const { w, h } = n;
  const H = w / Math.SQRT2;
  // the hall is long along u and shallow along v, and reaches as far as the set's square would
  const hu = H * 1.45;
  const hv = H * 0.6;
  const storeys = Math.max(1, Math.floor(h / FLOOR));
  const halls = Math.max(1, Math.round(storeys / 3.2));
  const cuts = Array.from({ length: halls + 1 }, (_, i) => Math.round((storeys * i) / halls));
  const parts: FormPart[] = [];
  for (let i = 0; i < halls; i++) {
    const z0 = i === 0 ? 0 : cuts[i] * FLOOR + 1.05;
    const z1 = i === halls - 1 ? h : cuts[i + 1] * FLOOR - 0.4;
    parts.push(boxPart(hu, hv, z0, z1, 0, 0, { h: SLOT_H }));
    if (i < halls - 1) parts.push(boxPart(hu - 0.9, hv - 0.9, z1, cuts[i + 1] * FLOOR + 1.05, 0, 0, { none: true }));
  }
  const unitH = 1.5;
  // the cooling units stand in two rows along the roof, or one down its middle on a narrow hall; the bay at the right end stays clear, for the drones
  const rows = hv > 5 ? [-0.42, 0.42] : [0];
  const across = Math.max(2, Math.floor((2 * hu * 0.84) / 3.3));
  const unitAt = (j: number) => -hu * 0.84 + (2 * hu * 0.84 * (j + 0.5)) / across;
  const units = across >= 3 ? across - 1 : across;
  const clear = unitAt(units - 1) + 1.25;
  return {
    parts,
    crest: h + unitH,
    // the pick holds the hall's ends and their louvers
    extent: Math.max(w * 1.1, pickReach(hu + 0.6)),
    // the drone lands in the clear bay, away from the plaque over the ground point
    drop: dropAt((clear + hu) / 2, 0, h, Math.min((hu - clear) / 2 - 0.3, hv - 0.4) - 0.2),
    shaft: parts.reduce((best, p, i) => (!p.glass?.none && p.z1 - p.z0 > parts[best].z1 - parts[best].z0 ? i : best), 0),
    dress(m, bd, b) {
      // a louver over the wall above every slot of glass, as far as the next slot or the hall's head
      for (let i = m.ribbons.length - 1; i >= 0 && m.ribbons[i].b === b; i--) {
        const r = m.ribbons[i];
        const z0 = r.y - bd.base + r.sy + 0.2;
        const head = parts.find((p) => !p.glass?.none && z0 > p.z0 && z0 < p.z1)?.z1 ?? h;
        const z1 = Math.min(z0 + FLOOR - r.sy - 0.6, head - 0.35);
        if (z1 - z0 < 1) continue;
        m.shapes.louver.push({ b, x: r.x - Math.sin(r.yaw) * 0.12, y: bd.base + z0, z: r.z - Math.cos(r.yaw) * 0.12, sx: r.sx + 0.4, sy: z1 - z0, sz: 0.6, yaw: r.yaw });
      }
      // the cooling units, a fan on each
      for (const rv of rows) {
        for (let j = 0; j < units; j++) {
          const u = unitAt(j);
          const v = rv * hv;
          m.boxes.push(boxAt(bd, b, u, v, 1.25, 1.1, h, h + unitH));
          m.shapes.fan.push({ ...boxAt(bd, b, u, v, 0.82, 0.82, h + unitH + 0.03, h + unitH + 0.04), sx: 0.82, sy: 1, sz: 0.82 });
        }
      }
    },
  };
}
