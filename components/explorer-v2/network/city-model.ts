import type { District } from "@/components/explorer-v2/network/districts";
import { TILT } from "@/components/explorer-v2/network/city-geometry";

/* The city model's materials and shared shapes: its massing and glass by
   face, the storey, and the drum's faces, for the map (icm-map.tsx) and
   downtown's tower (hub-tower.tsx). */

/** a set's nodes on the page's target version, a minor behind, older, or unreported */
export type Band = "on" | "near" | "stale" | "unknown";
export const BAND_ORDER: Band[] = ["on", "near", "stale", "unknown"];

/* The city's model: white massing, face by face, lit from the left, and
   glass by what the windows say: each district's own tint by default,
   downtown's in the Avalanche red, or a client version under the Versions
   lens. In the dark the massing goes to slate and the windows glow. */
export const MASS = {
  top: "fill-white dark:fill-[#2D313B]",
  left: "fill-[#EDEFF4] dark:fill-[#23262E]",
  right: "fill-[#DCDFE6] dark:fill-[#191B21]",
};
export const EDGE = "stroke-[#1E1B3A]/[0.13] dark:stroke-white/[0.07]";
export type Glass = Band | District | "downtown" | "plain" | "pick" | "fresh";
/* each glass, its lit face then its shaded one */
export const GLASS: Record<Glass, [string, string]> = {
  on: ["fill-[#34C77B] dark:fill-[#4ADE80]", "fill-[#25A062] dark:fill-[#35BE68]"],
  near: ["fill-[#F4B63C] dark:fill-[#FCD34D]", "fill-[#CF9425] dark:fill-[#E2B53B]"],
  stale: ["fill-[#EF4B56] dark:fill-[#FB7185]", "fill-[#C5333E] dark:fill-[#E0596C]"],
  unknown: ["fill-[#BCC3CD] dark:fill-[#4A4F5C]", "fill-[#9EA6B2] dark:fill-[#3B3F4A]"],
  plain: ["fill-[#B5C6DA] dark:fill-[#EFD9A0]", "fill-[#93A8C0] dark:fill-[#CDB77F]"],
  pick: ["fill-[#3787F2] dark:fill-[#6AA8FF]", "fill-[#1F66CE] dark:fill-[#4E8DF0]"],
  // a new L1 still going up: a cool steel glass, calm, its building site says the rest
  fresh: ["fill-[#9FB0C8] dark:fill-[#B4C2D6]", "fill-[#8193AD] dark:fill-[#95A6BE]"],
  /* the districts' glass, one tint each and none a status, each the color its trade is known by:
     Finance emerald (wealth), Enterprise sapphire (trust), Culture tangerine (a crowd's energy),
     Gaming amethyst (play), AI aqua (clarity), Infrastructure graphite (the utility under it all),
     the Frontier sandstone (unbuilt ground). All calmed to the brand's cool, desaturated grade, so
     the one saturated color in the city is downtown's, on the brand's own red ramp */
  downtown: ["fill-[#E6212F] dark:fill-[#FF394A]", "fill-[#B20F2A] dark:fill-[#E6212F]"],
  finance: ["fill-[#5D9879] dark:fill-[#8BC8A6]", "fill-[#447A5F] dark:fill-[#73AC8D]"],
  enterprise: ["fill-[#6B89C0] dark:fill-[#93ADDC]", "fill-[#516DA1] dark:fill-[#7794C9]"],
  culture: ["fill-[#C18862] dark:fill-[#E2AE8C]", "fill-[#A26C48] dark:fill-[#CA9370]"],
  gaming: ["fill-[#A07BB6] dark:fill-[#C3A0D9]", "fill-[#826098] dark:fill-[#AA86C0]"],
  ai: ["fill-[#5F9FAD] dark:fill-[#87C3D0]", "fill-[#4A818D] dark:fill-[#6DAAB7]"],
  infrastructure: ["fill-[#8893A2] dark:fill-[#ACB7C5]", "fill-[#6C7784] dark:fill-[#939EAC]"],
  frontier: ["fill-[#AF9F89] dark:fill-[#D2C4AF]", "fill-[#91826D] dark:fill-[#B9AA95]"],
};
/** a district's glass as a CSS color, for the key and the lists: its lit face in the light theme */
export const DISTRICT_GLASS: Record<District | "downtown", string> = {
  downtown: "#E6212F",
  finance: "#5D9879",
  enterprise: "#6B89C0",
  culture: "#C18862",
  gaming: "#A07BB6",
  ai: "#5F9FAD",
  infrastructure: "#8893A2",
  frontier: "#AF9F89",
};
/* the ground's paint, day and night: the P-Chain's fired clay under the
   white model. The map draws with these classes and the 3D view reads the
   same ones, as it does GLASS and MASS, so the two cannot drift */
export const GROUND = {
  plateTop: "fill-[#F7F3EC] dark:fill-[#14100D]",
  plateTopDim: "fill-[#F0EAE0] dark:fill-[#1B1511]",
  plateStroke: "stroke-[#DAD5CB] dark:stroke-[#2E2F34]",
  plateFoot: "stroke-[#A8A398] dark:stroke-[#0E0F12]",
  streets: "fill-[#ECE8E0] dark:fill-[#0A0907]",
  pad: "fill-[#F2EFE8] stroke-[#1E1B3A]/[0.05] dark:fill-[#15120F] dark:stroke-white/[0.04]",
  park: "fill-[#E2F0E4] dark:fill-[#12211A]",
  siteLot: "fill-[#D99A06]/[0.05] stroke-[#B98509]/45 dark:fill-[#F2C14E]/[0.05] dark:stroke-[#F2C14E]/40",
  banks: "fill-[#E4F1E6] dark:fill-[#12211A]",
  water: "fill-[#D5E9F7] stroke-[#AFD2EC] dark:fill-[#12304A] dark:stroke-[#27557D]",
  current: "stroke-white/80 dark:stroke-[#3E6A8F]/60",
  bridges: "fill-[#FBFAF7] stroke-[#CFC5B5] dark:fill-[#221E19] dark:stroke-[#3D342A]",
  blockLip: "fill-[#DAD3C7] dark:fill-[#070605]",
  blockEdge: "stroke-[#1E1B3A]/[0.10] dark:stroke-white/[0.06]",
  block: "fill-white dark:fill-[#1B1C21]",
  blockAway: "fill-[#FAF9F6] dark:fill-[#16130F]",
  gardens: "fill-[#E4F1E6] dark:fill-[#13241B]",
  plots: "stroke-[#1E1B3A]/[0.07] dark:stroke-white/[0.05]",
  plaza: "fill-white stroke-[#E6212F]/25 dark:fill-[#1B1C21] dark:stroke-[#E6212F]/40",
  plazaRing: "stroke-[#E6212F]/15 dark:stroke-[#E6212F]/25",
  treeShade: "fill-[#1E1B3A]/[0.07] dark:fill-black/40",
  tree: "fill-[#A3D4AE] dark:fill-[#2F5E42]",
  // the outskirts' low houses, and the new sites' piles of sand and gravel
  houseEdge: "stroke-[#1E1B3A]/[0.07] dark:stroke-white/[0.04]",
  houseLeft: "fill-[#F0F0F2] dark:fill-[#1C1D22]",
  houseRight: "fill-[#E5E6EA] dark:fill-[#16171B]",
  houseTop: "fill-[#FCFCFC] dark:fill-[#22242A]",
  pileLeft: "fill-[#E6DDCF] dark:fill-[#2E271F]",
  pileRight: "fill-[#D8CDBA] dark:fill-[#252019]",
  pileTop: "fill-[#F0EAE0] dark:fill-[#3A3128]",
} as const;
/** the pick that opens the P-Chain's own pane: its wing downtown in 3D, its caption on the rim in the model */
export const PCHAIN_PICK = "p-chain";
/** the explorer's P-Chain mark, as its subnav shows it */
export const PCHAIN_LOGO =
  "https://images.ctfassets.net/gcj8jwzm6086/42aMwoCLblHOklt6Msi6tm/1e64aa637a8cead39b2db96fe3225c18/pchain-square.svg";
/** a storey's height; its ribbon of glass sits in the middle of it */
export const FLOOR = 6;
/** a set this tall steps back over a podium */
export const TALL = 58;
/** how long a set's colors take to come on */
export const LIGHTS_MS = 1100;

/* a point on a drum's rim, t radians round from its right, a quarter turn at its front */
export const rimAt = (x: number, y: number, r: number, t: number, z: number): [number, number] => [x + r * Math.cos(t), y + r * TILT * Math.sin(t) - z];
/* a band of a drum's face between two turns, z0 to z1: its lit half runs from the left to the front, its shaded half on to the right */
export function drumBand(x: number, y: number, r: number, z0: number, z1: number, t0: number, t1: number): string {
  const f = (v: number) => v.toFixed(1);
  const ry = r * TILT;
  const [ax, ay] = rimAt(x, y, r, t0, z0);
  const [bx, by] = rimAt(x, y, r, t1, z0);
  const [cx, cy] = rimAt(x, y, r, t1, z1);
  const [dx, dy] = rimAt(x, y, r, t0, z1);
  return `M${f(ax)},${f(ay)}A${f(r)},${f(ry)} 0 0 0 ${f(bx)},${f(by)}L${f(cx)},${f(cy)}A${f(r)},${f(ry)} 0 0 1 ${f(dx)},${f(dy)}Z`;
}
export const DRUM_FACE: [number, number][] = [
  [Math.PI, Math.PI / 2],
  [Math.PI / 2, 0],
];
