import type { Node } from "@/components/explorer-v2/network/icm-map";
import { FLOOR, boxAt, boxPart, dropAt, facesOf, glassHalf, halvesOn, onFace, shapeAt, storeyAt, type FormPart, type Plan, type Roll } from "./frame";

/* Finance is Wall Street: stone towers of the old exchange's grammar. A
   base of a storey or two, pilastered, banded, or a colonnade under the
   shaft; a shaft of stone piers between its windows, so its glass reads
   as punched bays; a heavy cornice, and on some an attic storey set back
   over it. The tall ones step back in the Deco way and end in a finned
   crown, and one set fronts its base with a temple: columns, entablature,
   pediment, on the face the home view sees (index.ts chooses it). */

/** a set this large (about 40 on the city's validator scale) steps back and wears a crown, where its height gives it room */
const DECO_VALIDATORS = 8;
const DECO_H = 34;
/** stone piers: their width, how far they stand off the wall, and the bay they aim for */
const PIER_W = 0.8;
const PIER_D = 0.62;
const BAY = 3.3;

/** a temple front: the face of the base it stands on (facesOf's order: 0 the lit face, 1 the shaded one, both toward the home view), and whether it is the full front or a smaller portico */
export interface Front {
  face: number;
  full: boolean;
}

export function financePlan(n: Node, roll: Roll, front: Front | null): Plan {
  const { w, h } = n;
  const H = w / Math.SQRT2;
  // the form reads the set's validators, not the height the Height switch draws, so it holds when the switch turns
  const tall = n.validators >= DECO_VALIDATORS && h >= DECO_H;
  const monument = front !== null;
  const colonnade = !monument && roll() < 0.3;
  // the base: one storey, two under the full temple front
  const pod = Math.min(front?.full ? storeyAt(2) : storeyAt(1), h * 0.5);
  const recess = colonnade ? 1.3 : 0;
  const parts: FormPart[] = [boxPart(H - recess, H - recess, 0, pod)];
  // the Deco setback, a storey's line near seven tenths up, and the crown's base; or the attic under the roof of a lower one
  const storeys = Math.floor(h / FLOOR);
  const attic = !tall && storeys >= 5 && roll() < 0.5;
  const banded = roll() < 0.45;
  const back = tall ? storeyAt(Math.round((h * 0.7) / FLOOR)) : attic ? storeyAt(storeys - 1) : h;
  const crownAt = h - 3.8;
  const Hb = H * 0.74;
  const Hc = H * 0.5;
  parts.push(boxPart(H, H, pod, back));
  if (attic) parts.push(boxPart(H * 0.88, H * 0.88, back, h));
  if (tall) {
    parts.push(boxPart(Hb, Hb, back, crownAt));
    parts.push(boxPart(Hc, Hc, crownAt, h, 0, 0, { none: true }));
  }
  // a plant room on the flat roofs, set back to the rear corner
  const plant = !tall && roll() < 0.5;
  const plantH = 3.4;
  return {
    parts,
    crest: h + (plant ? plantH : 0),
    extent: w * (monument ? 1.25 : 1.05),
    shaft: 1,
    // the drone lands clear of the plaque over the ground point: on a Deco tower's setback terrace, else on the roof toward its right face, clear of the plant room
    drop: tall ? dropAt(H * 0.87 + 0.55, 0, back, H * 0.13 - 0.2) : dropAt(H * 0.6, H * 0.15, h, H * (attic ? 0.28 : 0.4) - 0.4),
    dress(m, bd, b) {
      const trim = m.shapes.trim;
      // stone piers up a run of the massing, between its windows, and a cornice over it
      const piers = (half: number, z0: number, z1: number, pw = PIER_W, pd = PIER_D, cornice = 0.55, skip = -1) => {
        for (const f of facesOf(half, half).filter((_, i) => i !== skip)) {
          const g = glassHalf(half, half, f);
          const bays = Math.max(2, Math.round((2 * g) / BAY));
          for (let i = 0; i <= bays; i++) {
            const s = -g + (2 * g * i) / bays;
            const [u, v] = onFace(f, s, pd / 2);
            const [hu, hv] = halvesOn(f, pw / 2, pd / 2);
            trim.push(boxAt(bd, b, u, v, hu, hv, z0, z1 - (cornice ? 1.05 : 0)));
          }
        }
        if (cornice) trim.push(boxAt(bd, b, 0, 0, half + cornice, half + cornice, z1 - 1.05, z1));
      };
      // the base: a string course over it, pilasters or a colonnade under it
      const Hp = H - recess;
      if (colonnade) {
        for (const f of facesOf(H, H)) {
          const g = glassHalf(H, H, f);
          const bays = Math.max(2, Math.round((2 * g) / (BAY * 1.35)));
          for (let i = 0; i <= bays; i++) {
            const [u, v] = onFace(f, -g + (2 * g * i) / bays, -0.55);
            m.shapes.column.push(shapeAt(bd, b, u, v, 0, 0.46, pod - 0.02, 0.46));
          }
        }
      } else if (banded && !monument) {
        // a banded base, the old banks' rusticated stone: a plinth course under the ground floor's windows, a band over them
        trim.push(boxAt(bd, b, 0, 0, Hp + 0.3, Hp + 0.3, 0, 1.3));
        trim.push(boxAt(bd, b, 0, 0, Hp + 0.22, Hp + 0.22, pod - 1.75, pod - 1.25));
      } else {
        // pilasters; the temple front stands in their place on its face
        piers(Hp, 0, pod, 1.15, 0.8, 0, front?.face ?? -1);
      }
      trim.push(boxAt(bd, b, 0, 0, H + 0.4, H + 0.4, pod - 0.7, pod));
      // the shaft, and the attic over its cornice
      piers(H, pod, back);
      if (attic) piers(H * 0.88, back, h, 0.62, 0.45, 0.35);
      if (tall) {
        // the setback's piers, finer, and the crown's fins up to the set's height
        piers(Hb, back, crownAt, 0.7, 0.55, 0.45);
        for (const f of facesOf(Hc, Hc)) {
          for (const s of [-0.62, 0, 0.62]) {
            const [u, v] = onFace(f, s * Hc, 0.3);
            const [hu, hv] = halvesOn(f, 0.34, 0.3);
            trim.push(boxAt(bd, b, u, v, hu, hv, crownAt, h));
          }
        }
        trim.push(boxAt(bd, b, 0, 0, Hc + 0.35, Hc + 0.35, h - 0.6, h));
        // a slim steel spire off the crown's back corner, clear of the plaque over its middle
        m.steel.push(boxAt(bd, b, -Hc * 0.62, -Hc * 0.62, 0.16, 0.16, h, h + 7));
      }
      if (plant) m.boxes.push(boxAt(bd, b, -H * 0.24, -H * 0.24, H * 0.36, H * 0.3, h, h + plantH));
      if (front) {
        // the temple front on its face: steps, six columns, the entablature and the pediment; a smaller portico has four, a storey tall
        const f = facesOf(Hp, Hp)[front.face];
        const cols = front.full ? 6 : 4;
        const span = Hp * (front.full ? 0.86 : 0.62);
        const deep = front.full ? 3.6 : 2.6;
        const step = front.full ? 0.9 : 0.6;
        const lintel = front.full ? 1.2 : 1;
        const r = front.full ? 0.55 : 0.42;
        const [su, sv] = onFace(f, 0, deep / 2);
        const [hu, hv] = halvesOn(f, span, deep / 2);
        m.boxes.push(boxAt(bd, b, su, sv, hu, hv, 0, step));
        const colH = pod - step - lintel;
        for (let i = 0; i < cols; i++) {
          const [u, v] = onFace(f, span * 0.84 * ((2 * i) / (cols - 1) - 1), deep - 0.9);
          m.shapes.column.push(shapeAt(bd, b, u, v, step, r, colH, r));
        }
        m.boxes.push(boxAt(bd, b, su, sv, hu, hv, step + colH, pod));
        m.shapes.gable.push(shapeAt(bd, b, su, sv, pod, span * 2, span * 0.42, deep, f.turn));
      }
    },
  };
}
