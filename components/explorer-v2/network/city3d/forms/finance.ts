import type { Node } from "@/components/explorer-v2/network/icm-map";
import { diceOf } from "@/components/explorer-v2/network/city-geometry";
import { FLOOR, boxAt, boxPart, dropAt, facesOf, glassHalf, glassRound, halvesOn, onFace, planAt, shapeAt, storeyAt, type FormPart, type Plan, type Roll } from "./frame";

/* Finance is the institutional district: towers of curtain wall in the
   district's calmed emerald glass, thin white fins up the glass, and a
   crown on every one, whose top line lights at night. The tall ones step
   back in the Deco way to a finned crown, others end in a pyramid or a
   lantern, and the largest carries a slim mast. The larger sets stand on
   a two-storey colonnade, and one set fronts its base with a temple:
   columns, entablature, pediment, on the face the home view sees
   (index.ts chooses it). Each podium's top carries a ticker, a band of
   glass that flashes with its chain's transactions. */

/** a set this large (about 40 on the city's validator scale) steps back and wears a Deco crown, where its height gives it room */
const DECO_VALIDATORS = 8;
const DECO_H = 34;
/** a set this large stands on a two-storey colonnade */
const COLONNADE_VALIDATORS = 5;
/** the curtain wall's glass, all but a thin spandrel of each storey, and its fins: their width, how far they stand off the glass, and
    the bay they aim for. The massing's lines fall three tenths over a storey's, and each run starts a little under the one it stands
    on and ends a little over the next one's foot, so that every storey of the wall takes its glass */
const CURTAIN = 5.2;
const LINE = 0.3;
const LAP = 0.8;
const FIN_W = 0.14;
const FIN_D = 0.45;
const BAY = 2.1;

/** a temple front: the face of the base it stands on (facesOf's order: 0 the lit face, 1 the shaded one, both toward the home view), and whether it is the full front or a smaller portico */
export interface Front {
  face: number;
  full: boolean;
}

export function financePlan(n: Node, roll: Roll, front: Front | null, largest = false): Plan {
  const { w, h } = n;
  const H = w / Math.SQRT2;
  const monument = front !== null;
  // the form reads the set's validators, not the height the Height switch draws, so it holds when the switch turns
  const tall = n.validators >= DECO_VALIDATORS && h >= DECO_H;
  const colonnade = !monument && n.validators >= COLONNADE_VALIDATORS && h >= 30;
  // the base: a storey, or two under a colonnade or the full temple front; the colonnade's glass stands back behind its columns
  const pod = Math.min(front?.full || colonnade ? storeyAt(2, LINE) : storeyAt(1, LINE), h * 0.5);
  const recess = colonnade ? 1.3 : 0;
  const crown = tall ? "deco" : roll() < 0.5 ? "pyramid" : "lantern";
  const parts: FormPart[] = [boxPart(H - recess, H - recess, 0, pod, 0, 0, { h: 4 })];
  // the shaft, and its top: the Deco setback near seven tenths up and its crown, or the roof a pyramid or a lantern stands on
  const back = storeyAt(Math.round((h * 0.7) / FLOOR), LINE);
  const crownAt = h - 3.8;
  const Hb = H * 0.74;
  const Hc = H * 0.5;
  const capHalf = H * 0.62;
  const capH = Math.min(capHalf * 1.25, h * 0.22);
  const roof = crown === "deco" ? back + LAP / 2 : crown === "pyramid" ? h - capH : h - 3.6;
  parts.push(boxPart(H, H, pod - LAP, roof, 0, 0, { h: CURTAIN }));
  if (crown === "deco") {
    parts.push(boxPart(Hb, Hb, back - LAP / 2, crownAt, 0, 0, { h: CURTAIN }));
    parts.push(boxPart(Hc, Hc, crownAt, h, 0, 0, { none: true }));
  }
  if (crown === "lantern") parts.push(boxPart(H * 0.8, H * 0.8, roof, h, 0, 0, { none: true }));
  // the drone lands on the terrace round the crown, toward the right face: the setback's, or the ring round a pyramid or a lantern
  const terrace = crown === "deco" ? [Hb + 0.55, H + 0.55] : [crown === "pyramid" ? capHalf : H * 0.8 + 0.45, H];
  const ring = (terrace[1] - terrace[0]) / 2 - 0.15;
  return {
    parts,
    crest: h,
    extent: w * (monument ? 1.25 : 1.05),
    shaft: 1,
    drop: dropAt((terrace[0] + terrace[1]) / 2, crown === "deco" ? 0 : H * 0.2, roof, ring),
    dress(m, bd, b) {
      const trim = m.shapes.trim;
      // fins up a run of the massing, across its glass on every face, but the one a temple front takes
      const fins = (half: number, z0: number, z1: number, fw = FIN_W, fd = FIN_D, skip = -1) => {
        for (const [i, f] of facesOf(half, half).entries()) {
          if (i === skip) continue;
          const g = glassHalf(half, half, f);
          const bays = Math.max(3, Math.round((2 * g) / BAY));
          for (let j = 0; j <= bays; j++) {
            const [u, v] = onFace(f, -g + (2 * g * j) / bays, fd / 2);
            const [hu, hv] = halvesOn(f, fw / 2, fd / 2);
            trim.push(boxAt(bd, b, u, v, hu, hv, z0, z1));
          }
        }
      };
      // the base: a colonnade, or a plinth course under a glazed ground floor; the temple front stands in their place on its face
      const Hp = H - recess;
      if (colonnade) {
        for (const f of facesOf(H, H)) {
          const g = glassHalf(H, H, f);
          const bays = Math.max(2, Math.round((2 * g) / (BAY * 2)));
          for (let i = 0; i <= bays; i++) {
            const [u, v] = onFace(f, -g + (2 * g * i) / bays, -0.55);
            m.shapes.column.push(shapeAt(bd, b, u, v, 0, 0.42, pod - 0.72, 0.42));
          }
        }
      } else if (!monument) {
        trim.push(boxAt(bd, b, 0, 0, Hp + 0.25, Hp + 0.25, 0, 0.9));
      }
      // the podium's entablature, and its ticker: a band of glass along its face that flashes as the chain's transactions come
      trim.push(boxAt(bd, b, 0, 0, H + 0.4, H + 0.4, pod - 0.72, pod));
      const ticker = glassRound(m, bd, b, H + 0.4, pod - 0.58, 0.36, "white", 0.03);
      for (const ids of bd.shaft.values()) ids.push(...ticker);
      // the shaft's fins, and on a Deco tower the setback's, a cornice line at each top
      fins(H, pod, roof);
      trim.push(boxAt(bd, b, 0, 0, H + FIN_D + 0.1, H + FIN_D + 0.1, roof - 0.5, roof));
      let lineAt = { half: H + FIN_D + 0.1, z: roof - 0.45 };
      if (crown === "deco") {
        fins(Hb, back, crownAt, 0.12, 0.4);
        trim.push(boxAt(bd, b, 0, 0, Hb + 0.5, Hb + 0.5, crownAt - 0.45, crownAt));
        // the crown's fins up to the set's height, three to a face, and its cap
        for (const f of facesOf(Hc, Hc)) {
          for (const s of [-0.62, 0, 0.62]) {
            const [u, v] = onFace(f, s * Hc, 0.3);
            const [hu, hv] = halvesOn(f, 0.3, 0.3);
            trim.push(boxAt(bd, b, u, v, hu, hv, crownAt, h));
          }
        }
        trim.push(boxAt(bd, b, 0, 0, Hc + 0.35, Hc + 0.35, h - 0.6, h));
        lineAt = { half: Hc + 0.35, z: h - 0.55 };
      } else if (crown === "pyramid") {
        // the pyramid over a terrace, its corners on the square's
        m.caps.push({ b, x: bd.x, y: bd.base + roof, z: bd.z, sx: capHalf * Math.SQRT2, sy: capH, sz: capHalf * Math.SQRT2, yaw: 0 });
      } else {
        // the lantern: a set-back crown box with its fins, over the terrace
        for (const f of facesOf(H * 0.8, H * 0.8)) {
          for (const s of [-0.66, -0.22, 0.22, 0.66]) {
            const [u, v] = onFace(f, s * H * 0.8, 0.2);
            const [hu, hv] = halvesOn(f, 0.12, 0.2);
            trim.push(boxAt(bd, b, u, v, hu, hv, roof, h));
          }
        }
        trim.push(boxAt(bd, b, 0, 0, H * 0.8 + 0.3, H * 0.8 + 0.3, h - 0.5, h));
        lineAt = { half: H * 0.8 + 0.3, z: h - 0.45 };
      }
      // the crown's line, which lights at night
      glassRound(m, bd, b, lineAt.half, lineAt.z, 0.3, "white", 0.03);
      if (largest && crown === "deco") {
        /* the district's largest carries a slim mast off its crown's back corner, its light over it: white, as a landmark's
           mast light is, since the hub's spire keeps the city's one red light */
        const [mu, mv] = [-Hc * 0.55, -Hc * 0.55];
        m.steel.push(boxAt(bd, b, mu, mv, 0.15, 0.15, h, h + 12));
        const [mx, mz] = planAt(mu, mv);
        m.lamps.push({ b, x: bd.x + mx, y: bd.base + h + 12.5, z: bd.z + mz, r: 0.6, white: true, beat: 2.8, phase: diceOf(`${bd.id}:mast`)() * 2.8 });
      }
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
