import type { Node } from "@/components/explorer-v2/network/icm-map";
import { boxAt, boxPart, dropAt, pickReach, planAt, shapeAt, storeyAt, YAW, type FormPart, type Plan, type Roll } from "./frame";

/* Culture's civic buildings. FIFA's chain is a stadium: a pitch in its
   markings, tiers of seats rising from it to a rounded back, a finned
   skin carrying a thin roof ring open over the pitch, and a floodlight
   pylon off each corner, its lamps at the set's height; every other set
   is a civic house of some kind: a museum (a glazed lobby under its
   galleries, boxes shifted off each other), a theatre (a glazed foyer
   before its hall, the fly tower over the stage), a concert hall (its
   auditorium's rake read as a wedge of roof), or a gallery (a long hall
   under a north-lit sawtooth roof). */

/** the sets that stand as stadiums, by chain ID: FIFA's (constants/l1-chains.json) */
export const STADIUMS = new Set(["13322"]);

/** the stadium in its own frame, a share of its half-length along u: its half-width, and the stands' depth from the
    pitch's square-cornered edge out to the rounded back, so the back's corners turn on that depth */
export const STAND_B = 0.76;
export const STAND_D = 0.37;
/** the stands in section, out from the pitch's edge: a front wall, five tiers of seats, each a tread and a riser, a walkway at the top */
const FRONT = 0.061;
const TREAD = 0.065;
const RISER = 0.052;
export const TIERS = 5;
export const STAND_PROFILE: [number, number][] = (() => {
  const out: [number, number][] = [
    [0, 0],
    [0, FRONT],
  ];
  for (let i = 0; i < TIERS; i++) out.push([(i + 1) * TREAD, FRONT + i * RISER], [(i + 1) * TREAD, FRONT + (i + 1) * RISER]);
  const top = FRONT + TIERS * RISER;
  out.push([STAND_D, top], [STAND_D, 0]);
  return out;
})();
/** the stands' top, a share of the half-length */
export const STAND_TOP = FRONT + TIERS * RISER;

export function stadiumPlan(n: Node, { lot, room }: { lot: number; room: number }): Plan {
  const { h } = n;
  // the stadium takes half its lot's pitch along u, short of a street from its neighbours' reach
  const A = Math.max(n.w, Math.min(lot * 0.5, room));
  const B = A * STAND_B;
  const D = A * STAND_D;
  // the pitch's edge, where the stands begin, and the stands' height
  const iu = A - D;
  const iv = B - D;
  const top = A * STAND_TOP;
  // the outer wall over the stands' back, the fins that carry the roof ring, and the ring itself, open over the pitch
  const wall = top + 0.6;
  const zR = top + 4.2;
  const roofIn = 3.8;
  const roofOut = D + 1.2;
  const roofMid = (roofIn + roofOut) / 2;
  // the pitch, inset from the stands' front wall, with the game's own proportions for its markings
  const L = 2 * (iu - 1);
  const W = 2 * (iv - 1);
  /* the main stand's roof, on the far side: the plaque stands toward its right end, where from the home view it clears the
     plaques of the towers in front, and the drone lands toward its left end */
  const vMain = -(iv + roofMid);
  const ring = (roofOut - roofIn) / 2 - 0.4;
  const parts: FormPart[] = [
    boxPart(0.2, iv, 0, wall, iu + D + 0.2, 0, { none: true }),
    boxPart(0.2, iv, 0, wall, -(iu + D + 0.2), 0, { none: true }),
    boxPart(iu, 0.2, 0, wall, 0, iv + D + 0.2, { none: true }),
    boxPart(iu, 0.2, 0, wall, 0, -(iv + D + 0.2), { none: true }),
  ];
  return {
    parts,
    crest: h,
    // the pick holds the bowl, its roof's overhang and the pylons' lamps
    extent: (A + 1.4) / 0.75,
    shaft: 0,
    anchor: dropAt(iu * 0.7, vMain, zR + 0.6),
    drop: dropAt(-iu * 0.45, vMain, zR + 0.6, ring),
    dress(m, bd, bi) {
      const trim = m.shapes.trim;
      /* a run round the pitch at a depth d out from its edge, in steps: each step's centre, its way out, and its length.
         Round a corner, a box's step is a tangent, as long as the arc at lenAt, so the boxes close there; a line's is a chord */
      const around = (d: number, step: number, { lenAt = d, chord = false, side = step }: { lenAt?: number; chord?: boolean; side?: number } = {}) => {
        const out: { u: number; v: number; out: number; len: number }[] = [];
        const sides: [number, number, number, number][] = [
          // the side's middle, its outward angle, its half-length along it
          [iu, 0, 0, iv],
          [0, iv, Math.PI / 2, iu],
          [-iu, 0, Math.PI, iv],
          [0, -iv, -Math.PI / 2, iu],
        ];
        for (const [cu, cv, a, half] of sides) {
          const cnt = Math.max(1, Math.round((2 * half) / side));
          for (let i = 0; i < cnt; i++) {
            const s = -half + (2 * half * (i + 0.5)) / cnt;
            // along the side, a quarter turn from its way out
            out.push({ u: cu + Math.cos(a) * d - Math.sin(a) * s, v: cv + Math.sin(a) * d + Math.cos(a) * s, out: a, len: (2 * half) / cnt });
          }
        }
        for (const [cu, cv, a0] of [
          [iu, iv, 0],
          [-iu, iv, Math.PI / 2],
          [-iu, -iv, Math.PI],
          [iu, -iv, -Math.PI / 2],
        ]) {
          const cnt = Math.max(2, Math.round(((Math.PI / 2) * d) / step));
          const half = Math.PI / 4 / cnt;
          const r = chord ? d * Math.cos(half) : d;
          for (let i = 0; i < cnt; i++) {
            const a = a0 + ((i + 0.5) / cnt) * (Math.PI / 2);
            out.push({ u: cu + Math.cos(a) * r, v: cv + Math.sin(a) * r, out: a, len: chord ? 2 * d * Math.sin(half) : 2 * lenAt * Math.tan(half) });
          }
        }
        return out;
      };
      // a box laid along the run: its local x out, its local z along it; a turn of -a lays local x on the way out
      const along = (st: { u: number; v: number; out: number; len: number }, depth: number, z0: number, z1: number, grow = 0) =>
        shapeAt(bd, bi, st.u, st.v, z0, depth, z1 - z0, st.len + grow, -st.out);
      // the stands, their seats in the steel's slate
      m.shapes.bowl.push(shapeAt(bd, bi, 0, 0, 0, A, A, A));
      // each tier's edge a line of glass along its riser, facing the pitch, lit at night; the tiers flash as the storeys do
      bd.shaft.clear();
      for (let i = 0; i < TIERS; i++) {
        const d = A * (i + 1) * TREAD - 0.04;
        const z0 = A * (FRONT + i * RISER) + A * RISER * 0.5;
        const ids: number[] = [];
        for (const st of around(d, 3, { chord: true, side: Infinity })) {
          const [wx, wz] = planAt(st.u, st.v);
          ids.push(m.ribbons.length);
          m.ribbons.push({ b: bi, x: bd.x + wx, y: bd.base + z0, z: bd.z + wz, sx: st.len, sy: A * RISER * 0.42, sz: 1, yaw: YAW - Math.PI / 2 - st.out, k: i, tone: "floor" });
        }
        bd.shaft.set(i, ids);
      }
      bd.k0 = 0;
      bd.k1 = TIERS - 1;
      // the back round the corners, where the four straight walls are the massing's parts
      for (const st of around(D + 0.2, 1.6, { lenAt: D + 0.4 }).filter((q) => Math.abs(Math.cos(q.out)) > 0.01 && Math.abs(Math.sin(q.out)) > 0.01)) trim.push(along(st, 0.4, 0, wall, 0.05));
      // the fins round the back, carrying the roof ring
      for (const st of around(D + 0.75, 2.3)) trim.push(along({ ...st, len: 0.26 }, 0.7, 0, zR + 0.6));
      // the roof ring, thin, cantilevered in over the upper tiers and open over the pitch
      for (const st of around(roofMid, 1.4, { lenAt: roofOut, side: Infinity })) trim.push(along(st, roofOut - roofIn, zR, zR + 0.6, 0.05));
      // the pitch, a calm grey-green, and its white markings
      const pitch = { ...boxAt(bd, bi, 0, 0, iu - 0.3, iv - 0.3, 0, 0.25), paint: "pitch" as const };
      trim.push(pitch);
      const line = (u: number, v: number, hu: number, hv: number) => trim.push({ ...boxAt(bd, bi, u, v, hu, hv, 0.25, 0.28), paint: "line" });
      const lw = 0.1;
      for (const s of [-1, 1]) {
        line(0, (s * W) / 2, L / 2, lw);
        line((s * L) / 2, 0, lw, W / 2);
        // the penalty area and the goal area, each three sides off the goal line, and the penalty spot
        const [pd, pw] = [L * 0.157, W * 0.296];
        const [gd, gw] = [L * 0.052, W * 0.135];
        line(s * (L / 2 - pd), 0, lw, pw);
        line(s * (L / 2 - pd / 2), pw, pd / 2, lw);
        line(s * (L / 2 - pd / 2), -pw, pd / 2, lw);
        line(s * (L / 2 - gd), 0, lw, gw);
        line(s * (L / 2 - gd / 2), gw, gd / 2, lw);
        line(s * (L / 2 - gd / 2), -gw, gd / 2, lw);
        line(s * (L / 2 - L * 0.105), 0, 0.16, 0.16);
      }
      line(0, 0, lw, W / 2);
      line(0, 0, 0.18, 0.18);
      // the centre circle in sixteen chords
      const rc = L * 0.087;
      for (let i = 0; i < 16; i++) {
        const a = ((i + 0.5) / 16) * 2 * Math.PI;
        trim.push({ ...shapeAt(bd, bi, Math.cos(a) * rc, Math.sin(a) * rc, 0.25, 2 * lw, 0.03, 2 * rc * Math.tan(Math.PI / 16), -a), paint: "line" });
      }
      /* a floodlight pylon off each corner of the bowl, clear of the roof ring: a slim mast, and a bank of lamps at its head,
         its top at the set's height. Each bank aims down the pitch's length, so from any side of the city its glass shows */
      for (const [su, sv] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
        const out = Math.atan2(sv, su);
        const [cu, cv] = [su * iu + Math.cos(out) * (D + 1.9), sv * iv + Math.sin(out) * (D + 1.9)];
        const aim = su > 0 ? Math.PI : 0;
        m.shapes.column.push(shapeAt(bd, bi, cu, cv, 0, 0.5, h - 1.7, 0.5));
        // the bank: its local x across the aim, its local z along it
        trim.push(shapeAt(bd, bi, cu, cv, h - 3.4, 5.6, 3.4, 1.4, -(aim + Math.PI / 2)));
        // the lamps' glass on both of its faces, lit at night
        for (const way of [aim, aim + Math.PI]) {
          const [wx, wz] = planAt(cu + Math.cos(way) * 0.73, cv + Math.sin(way) * 0.73);
          m.ribbons.push({ b: bi, x: bd.x + wx, y: bd.base + h - 3.1, z: bd.z + wz, sx: 5.2, sy: 2.8, sz: 1, yaw: YAW + Math.PI / 2 - way, k: -1, tone: "white" });
        }
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
      // the pick holds the foyer's canopy
      extent: Math.max(w * 1.05, pickReach(H * 1.1 + 0.5)),
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
    // the pick holds the long hall's ends
    extent: Math.max(w * 1.05, pickReach(hu + 0.35)),
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
