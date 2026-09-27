import type { Node } from "@/components/explorer-v2/network/icm-map";
import { boxAt, boxPart, dropAt, drumPart, planAt, shapeAt, storeyAt, YAW, type FormPart, type Plan, type Roll } from "./frame";

/* Culture's civic buildings. FIFA's chain is a stadium: a bowl of stands
   under its roof ring, floodlight masts at its corners, and its main stand
   rising to the set's height on the far side; every other set
   is a civic house of some kind: a museum (a glazed lobby under its
   galleries, boxes shifted off each other), a theatre (a glazed foyer
   before its hall, the fly tower over the stage), a concert hall (its
   auditorium's rake read as a wedge of roof), or a gallery (a long hall
   under a north-lit sawtooth roof). */

/** the sets that stand as stadiums, by chain ID: FIFA's (constants/l1-chains.json) */
export const STADIUMS = new Set(["13322"]);

/** the stadium's upper storeys in section, outside in: its outer wall flaring out over the concourses, the roof
    ring, and the stands raked down to the pitch. Radius 1 is the widest, height 1 the roof; the pitch is at 0 */
export const PITCH_R = 0.46;
export const STADIUM_PROFILE: [number, number][] = (() => {
  const out: [number, number][] = [
    [0.95, 0],
    [1, 0.34],
    [1, 0.84],
    [1.035, 0.86],
    [1.035, 1],
    [0.66, 0.965],
    [0.645, 0.9],
    [0.87, 0.82],
    [0.87, 0.74],
  ];
  // six tiers of stands, each a tread and a riser
  const [r0, y0, steps] = [0.87, 0.74, 6];
  for (let j = 0; j < steps; j++) {
    const r = r0 - ((r0 - PITCH_R) * (j + 1)) / steps;
    out.push([r, y0 - (y0 * j) / steps], [r, y0 - (y0 * (j + 1)) / steps]);
  }
  return out;
})();

export function stadiumPlan(n: Node, { lot, room }: { lot: number; room: number }): Plan {
  const { h } = n;
  // the bowl is an ellipse along the city's grid, taking half its lot's pitch, short of a street from its neighbours' reach
  const a = Math.max(n.w, Math.min(lot * 0.5, room));
  const b = a * 0.8;
  // the concourse storey, the bowl and its roof ring over it
  const zc = Math.min(storeyAt(1), h * 0.3);
  const B = Math.min(zc + 11, h * 0.62);
  // the main stand rises to the set's height along the bowl's far side, its hospitality floors glazed to the pitch
  const su = a * 0.74;
  const sv = 3.8;
  const sAt = -(b - sv) * 0.97;
  const parts: FormPart[] = [boxPart(su, sv, 0, h, 0, sAt), drumPart(a * 0.95, b * 0.95, 0, zc)];
  return {
    parts,
    crest: h,
    // the pick reaches the floodlight masts
    extent: a * 1.1,
    shaft: 0,
    // the drone lands on the main stand's roof toward its right end, beside the plaque and clear of the floodlight masts
    drop: dropAt(su * 0.58, sAt + 3.2, h, Math.min(sv + 2.8, su * 0.26)),
    dress(m, bd, bi) {
      m.shapes.bowl.push(shapeAt(bd, bi, 0, 0, zc, a, B - zc, b));
      // the pitch, in the rake's foot
      m.greens.push(boxAt(bd, bi, 0, 0, a * PITCH_R * 0.76, b * PITCH_R * 0.62, zc - 0.1, zc + 0.25));
      // the main stand's upper tiers, raked down to the pitch over its glazed boxes, and its roof reaching out over them
      const front = sAt + sv;
      for (let z = B + 4; z + 6 < h - 4; z += 12) m.shapes.saw.push(shapeAt(bd, bi, 0, front + 2.3, z, 4.6, 5.2, 2 * su * 0.94, Math.PI / 2));
      m.boxes.push(boxAt(bd, bi, 0, sAt + 3.2, su + 0.6, sv + 3.4, h - 1.1, h));
      // floodlight masts at the four diagonals, clear of the roof, their heads turned down to the pitch
      const top = Math.max(B + 12, h * 0.75);
      for (const t of [0.25, 0.75, 1.25, 1.75]) {
        const u = Math.cos(t * Math.PI) * a * 1.06;
        const v = Math.sin(t * Math.PI) * b * 1.06;
        m.steel.push(boxAt(bd, bi, u, v, 0.26, 0.26, 0, top));
        m.steel.push(shapeAt(bd, bi, u * 0.985, v * 0.985, top - 2.2, 4.4, 3, 0.45, Math.atan2(-u, -v), 0.55));
      }
    },
  };
}

export function civicPlan(n: Node, roll: Roll): Plan {
  const { w, h } = n;
  const H = w / Math.SQRT2;
  const a = roll();
  // a set of one or two validators is a gallery; the form reads the set's validators, not the height the Height switch draws
  const kind = n.validators <= 2 || h < 24 ? "gallery" : a < 0.3 ? "museum" : a < 0.6 ? "theatre" : a < 0.8 ? "hall" : "gallery";
  if (kind === "museum") {
    // the museum: a glazed lobby, and over it two galleries, boxes shifted off each other, lit by slot windows
    const storeys = Math.floor(h / 6);
    const mid = 1 + Math.round((storeys - 1) / 2);
    const lobby = storeyAt(1);
    const cut = storeyAt(mid);
    const shift = (f: number): [number, number] => {
      const t = roll() * 2 * Math.PI;
      const room = H * (1 - f);
      return [Math.cos(t) * room, Math.sin(t) * room];
    };
    const fa = 0.9 + roll() * 0.08;
    const fb = 0.78 + roll() * 0.1;
    const [ua, va] = shift(fa);
    const [ub, vb] = shift(fb);
    // the drone lands on the top gallery's front corner, toward the camera, clear of the plaque over the ground point
    const ringM = H * fb * 0.24;
    const museumDrop = (): [number, number] => [ub + H * fb - ringM - 0.4, vb + H * fb - ringM - 0.4];
    const parts: FormPart[] = [
      boxPart(H * 0.84, H * 0.84, 0, lobby, 0, 0, { h: 4.6 }),
      boxPart(H * fa, H * fa, lobby, cut, ua, va, { h: 1.3 }),
      boxPart(H * fb, H * fb, cut, h, ub, vb, { h: 1.3 }),
    ];
    return { parts, crest: h, extent: w * 1.05, shaft: 1, dress() {}, drop: dropAt(...museumDrop(), h, ringM) };
  }
  if (kind === "theatre") {
    // the hall, its glazed foyer in front on the lit face, the fly tower over the stage behind; the fly tower stands over the ground point, where the plaque stands
    const zA = storeyAt(Math.max(2, Math.round((h * 0.62) / 6)));
    const zF = Math.max(storeyAt(1), zA - 6);
    const fly = -H * 0.3;
    const parts: FormPart[] = [
      boxPart(H, H * 0.78, 0, zA, 0, -H * 0.22),
      boxPart(H, H * 0.2, 0, zF, 0, H * 0.76, { h: 4.6 }),
      boxPart(H * 0.64, H * 0.44, zA, h, 0, fly, { none: true }),
    ];
    return {
      parts,
      crest: h,
      extent: w * 1.05,
      shaft: 0,
      // the drone lands on the auditorium's roof beside the fly tower, clear of the plaque
      drop: dropAt(H * 0.82, fly, zA, H * 0.18 - 0.3),
      dress(m, bd, bi) {
        // the foyer's canopy, and a cornice line round the fly tower's head
        m.shapes.trim.push(boxAt(bd, bi, 0, H * 0.84, H + 0.5, H * 0.26 + 0.5, zF - 0.5, zF));
        m.shapes.trim.push(boxAt(bd, bi, 0, fly, H * 0.64 + 0.3, H * 0.44 + 0.3, h - 0.7, h));
      },
    };
  }
  if (kind === "hall") {
    /* the concert hall: its auditorium's rake read on its roof, a wedge rising from the front to the stage
       house, which stands at the set's height over the back half; the wedge's head meets it over the ground point */
    const rise = Math.min(8, h * 0.22);
    const z1 = h - rise;
    return {
      parts: [boxPart(H, H * 0.92, 0, z1), boxPart(H / 2, H * 0.92, z1, h, -H / 2, 0, { none: true })],
      crest: h,
      extent: w * 1.05,
      shaft: 0,
      // the drone lands on the stage house's roof at its front end, clear of the plaque on the rake's head
      drop: dropAt(-H * 0.22, H * 0.7, h, H * 0.22 - 0.3),
      dress(m, bd, bi) {
        m.shapes.saw.push(shapeAt(bd, bi, H * 0.49, 0, z1, H * 0.98, rise, 2 * H * 0.92 * 0.98, Math.PI));
        m.shapes.trim.push(boxAt(bd, bi, 0, 0, H + 0.4, H * 0.92 + 0.4, z1 - 0.7, z1));
        m.shapes.trim.push(boxAt(bd, bi, -H / 2, 0, H / 2 + 0.3, H * 0.92 + 0.3, h - 0.6, h));
      },
    };
  }
  // the gallery: a long hall, and a sawtooth roof whose glass faces away from the sun
  const hu = H * 1.16;
  const hv = H * 0.8;
  const roof = Math.min(4.2, h * 0.18);
  const z1 = h - roof;
  const teeth = 4;
  const L = (2 * hu) / teeth;
  return {
    parts: [boxPart(hu, hv, 0, z1)],
    crest: h,
    extent: w * 1.05,
    shaft: 0,
    // the drone lands on the last tooth's slope, halfway up, clear of the plaque
    drop: dropAt(-hu + L * 3.5, 0, z1 + roof / 2, L / 2 - 0.3),
    dress(m, bd, bi) {
      for (let i = 0; i < teeth; i++) {
        const u = -hu + L * (i + 0.5);
        m.shapes.saw.push(shapeAt(bd, bi, u, 0, z1, L, roof, 2 * hv * 0.96));
        // the tooth's north light, in the building's top storey's glass
        const [wx, wz] = planAt(u + L / 2 + 0.04, 0);
        m.ribbons.push({ b: bi, x: bd.x + wx, y: bd.base + z1 + roof * 0.12, z: bd.z + wz, sx: 2 * hv * 0.84, sy: roof * 0.76, sz: 1, yaw: YAW + Math.PI / 2, k: -1, tone: "top" });
      }
      m.shapes.trim.push(boxAt(bd, bi, 0, 0, hu + 0.35, hv + 0.35, z1 - 0.6, z1));
    },
  };
}
