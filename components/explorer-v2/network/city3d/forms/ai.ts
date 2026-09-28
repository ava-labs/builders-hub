import type { Node } from "@/components/explorer-v2/network/icm-map";
import { TILT } from "@/components/explorer-v2/network/city-geometry";
import { FLOOR, boxAt, boxPart, dropAt, drumPart, pickReach, planAt, type FormPart, type Plan } from "./frame";

/* AI builds in rounded glass: towers on a stadium-shaped plan, their
   ends turned in half drums, glass run round them storey by storey, each
   floor plate's edge a fine line proud of the glass, a garden of
   frost-grey trees on the roof. Calm, and a little ahead of the rest of
   the city. */

export function aiPlan(n: Node): Plan {
  const { w, h } = n;
  const H = w / Math.SQRT2;
  const hu = H * 1.12;
  const hv = H * 0.66;
  const core = hu - hv;
  const [ax, az] = planAt(core, 0);
  const [bx, bz] = planAt(-core, 0);
  // the drums stand off the ground point on screen, as a part's offset is
  const end = (x: number, z: number): FormPart => ({ ...drumPart(hv, hv, 0, h), dx: x, dy: z * TILT });
  const parts: FormPart[] = [boxPart(core, hv, 0, h), end(ax, az), end(bx, bz)];
  return {
    parts,
    crest: h,
    // the pick holds the half drums' ends and their floor plates
    extent: Math.max(w * 1.05, pickReach(hu + 0.35)),
    shaft: 0,
    // the drone lands on the roof of the right end's half drum, clear of the garden and the plaque
    drop: dropAt(core + hv * 0.45, 0, h, hv * 0.5 - 0.4),
    dress(m, bd, b) {
      // the floor plates' edges, a fine line proud of the glass at every storey
      for (let z = FLOOR; z < h - 1; z += FLOOR) {
        m.shapes.trim.push(boxAt(bd, b, 0, 0, core, hv + 0.35, z - 0.2, z + 0.25));
        for (const [x, zz] of [
          [ax, az],
          [bx, bz],
        ])
          m.drums.push({ b, x: bd.x + x, y: bd.base + z - 0.2, z: bd.z + zz, sx: hv + 0.35, sy: 0.45, sz: hv + 0.35, yaw: 0 });
      }
      // the roof garden: its lawn and a few frost-grey trees
      m.greens.push(boxAt(bd, b, 0, 0, core, hv * 0.72, h, h + 0.3));
      for (const [u, v] of [
        [-core * 0.7, -hv * 0.3],
        [core * 0.1, hv * 0.34],
        [core * 0.8, -hv * 0.2],
      ]) {
        const [x, z] = planAt(u, v);
        m.trees.push({ x: bd.x + x, y: bd.base + h + 0.3, z: bd.z + z, r: Math.max(1, hv * 0.16), b });
      }
    },
  };
}
