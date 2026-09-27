import { CX, CY, TALL, type Node } from "@/components/explorer-v2/network/icm-map";
import { diceOf, TILT } from "@/components/explorer-v2/network/city-geometry";
import { financePlan, type Front } from "./finance";
import { civicPlan, stadiumPlan, STADIUMS } from "./culture";
import { hallPlan } from "./infrastructure";
import { enterprisePlan } from "./enterprise";
import { gamingPlan } from "./gaming";
import { aiPlan } from "./ai";
import { planAt, type Plan } from "./frame";

export { noShapes, SHAPE_KEYS, type FormPart, type Plan, type ShapeKey } from "./frame";

/* Each district's architecture: the grammar its sets are built in, by
   what the district is for. A form reads only its set's district, its
   validator height, its lot and its seed, never its traffic, so it holds
   still through a visit. A district without a grammar yet keeps the
   city's general forms (icm-map.tsx), and so does a new L1, which goes up
   as a plain box in its scaffolding. */

/** the share of its lot a set's square reaches, as the map sizes it (icm-map.tsx): a talking set's, and a quiet one's */
const LOT_TALKER = 0.4;
const LOT_QUIET = 0.31;
/** the map's validator scale (icm-map.tsx), so the choices that read a set's height hold when the Height switch turns */
const H_MIN = 14;
const H_MAX = 165;
const H_POW = 0.4;
const H_TOP_MIN = 100;
/** the home camera looks straight on at the plate's front from 30 degrees up (Rig.tsx's HOME_POLAR): a line of sight to it runs to the front and rises this much a unit */
const HOME_RISE = Math.tan(Math.PI / 6);
/** the full temple front needs a set this tall on the validator scale and this wide: two storeys and six columns */
const TEMPLE_H = 26;
const TEMPLE_W = 12;

/** a planner for one plan of the city: each set's form, knowing the sets round it */

export function plannerOf(nodes: Node[]): (n: Node) => Plan | null {
  // the sets by size: the most validators, then the first by ID
  const ranked = nodes.filter((n) => n.role !== "hub" && n.newAt === null).sort((a, b) => b.validators - a.validators || (a.id < b.id ? -1 : 1));
  /* how far a set's lot is free: its lot's pitch, read back from its footprint, and the room to the nearest
     neighbour's widest reach (a talking set's) less a street; a talking neighbour or a quiet one leaves the same room */
  const at = (n: Node): [number, number] => [n.x - CX, (n.y - CY) / TILT];
  const roomOf = (n: Node) => {
    const lot = n.w / (n.role === "talker" ? LOT_TALKER : LOT_QUIET);
    const [x, z] = at(n);
    const near = Math.min(...nodes.filter((o) => o !== n).map((o) => Math.hypot(at(o)[0] - x, at(o)[1] - z)));
    return { lot, room: near - lot * LOT_TALKER * 1.05 - 2 };
  };
  // the height a set stands at on the validator scale, whichever metric the Height switch draws
  const top = Math.max(H_TOP_MIN, ...nodes.map((n) => n.validators));
  const standOf = (n: Node) => H_MIN + (H_MAX - H_MIN) * Math.pow(n.validators / top, H_POW);
  // the skyline's landmarks, as the model counts them (the three tallest over TALL), on the validator scale
  const landmarks = new Set(
    ranked
      .filter((n) => standOf(n) > TALL)
      .slice(0, 3)
      .map((n) => n.id),
  );
  /* whether a face of a set's base shows from the home camera: three points across a temple front on it, at
     its columns and its pediment, each seen past every other set's square at its height on the validator scale */
  const shows = (n: Node, face: number) => {
    const [x, z] = at(n);
    const H = n.w / Math.SQRT2;
    const out = H + 3.6;
    let seen = 0;
    for (const s of [-0.72 * H, 0, 0.72 * H]) {
      const [wx, wz] = face === 0 ? planAt(s, out) : planAt(out, s);
      const [px, pz] = [x + wx, z + wz];
      for (const y of [3, 13.6]) {
        const hidden = nodes.some((o) => {
          if (o === n) return false;
          const [ox, oz] = at(o);
          const reach = (o.role === "hub" ? 1.8 : 1) * o.w - Math.abs(px - ox);
          // the line of sight crosses the square where it runs within its reach, from its near corner to its far one
          if (reach <= 0 || oz + reach <= pz) return false;
          return standOf(o) > y + Math.max(0, oz - reach - pz) * HOME_RISE;
        });
        if (!hidden) seen++;
      }
    }
    return seen >= 5;
  };
  /* the temple front, one to the district, where the home camera sees it: on the largest set with a clear face
     toward the home view that is large enough to carry it, the lit face first; else a smaller portico on the
     largest set in that front row */
  const front = ((): (Front & { id: string }) | null => {
    const row = ranked.flatMap((n) => {
      const face = n.district === "finance" ? [0, 1].find((f) => shows(n, f)) : undefined;
      return face === undefined ? [] : [{ n, face }];
    });
    const big = row.find(({ n }) => standOf(n) >= TEMPLE_H && n.w >= TEMPLE_W);
    const pick = big ?? row[0];
    return pick ? { id: pick.n.id, face: pick.face, full: !!big } : null;
  })();
  return (n) => {
    if (n.role === "hub" || n.newAt !== null) return null;
    const roll = diceOf(`${n.id}:arch`);
    switch (n.district) {
      case "finance":
        return financePlan(n, roll, front?.id === n.id ? front : null);
      case "culture":
        return STADIUMS.has(n.id) ? stadiumPlan(n, roomOf(n)) : civicPlan(n, roll);
      case "infrastructure":
        return hallPlan(n);
      case "enterprise":
        return enterprisePlan(n, roll);
      case "gaming":
        return gamingPlan(n, roll, landmarks.has(n.id));
      case "ai":
        return aiPlan(n);
      default:
        return null;
    }
  };
}
