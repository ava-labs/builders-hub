import { FAM, GLASS, type Fam, type Glass } from "@/components/explorer-v2/network/icm-map";

/* The 3D city's colors. The glass and the ledger's tiles are read from the
   city's classes (city-model.ts), so the districts' calmed hues show here as
   they are set there; the grade round them (the massing, the ground, the
   roofs, the lights) is the brand's own, each color named for the part of
   the city it paints. */

export type Theme = "light" | "dark";

/** a class pair's color in one theme: `fill-[#hex] dark:fill-[#hex]`, or `fill-white` */
export function hexOf(classes: string, dark: boolean): string {
  for (const c of classes.split(/\s+/)) {
    const isDark = c.startsWith("dark:");
    if (isDark !== dark) continue;
    const bare = isDark ? c.slice(5) : c;
    const hex = /^(?:fill|stroke|bg)-\[(#[0-9A-Fa-f]{6})\]/.exec(bare);
    if (hex) return hex[1];
    if (/^(?:fill|stroke|bg)-white/.test(bare)) return "#FFFFFF";
    if (/^(?:fill|stroke|bg)-black/.test(bare)) return "#000000";
  }
  return dark ? "#2D313B" : "#FFFFFF";
}

export interface Pair {
  light: string;
  dark: string;
}
const pair = (classes: string): Pair => ({ light: hexOf(classes, false), dark: hexOf(classes, true) });
const P = (light: string, dark: string): Pair => ({ light, dark });

/* The city's grade, the brand's: an architect's white model of a financial
   district, lit for a board meeting. By day a cool near-white massing with
   steel shading on the brand's cool ground (#EBF0FA); by night graphite on
   the brand's dark (#1F1F1F). Everything cool and quiet, so the glass's
   calmed district hues and the brand's red carry the meaning. */

/** the massing: its walls (the light shades them), the frame of its curtain walls, and its crisp edges */
export const MASS3 = {
  wall: P("#F4F6F9", "#2B3036"),
  frame: P("#DCE3EC", "#3B434B"),
  edge: P("#8C98A6", "#4F5B66"),
};
/** each glass, its lit face (the 3D light shades the rest) */
export const GLASS3 = Object.fromEntries(Object.entries(GLASS).map(([g, [lit]]) => [g, pair(lit)])) as Record<Glass, Pair>;
/** the curtain wall's glass itself, which each district's calmed hue tints: a cool blue-gray by day, a lit room's calm white by night (lit at seven tenths) */
export const GLASS_BASE = P("#6E7F92", "#EBF0FA");

/** the ground: the plate, its streets, blocks and lawns, the river and the outskirts, in quiet cool greys */
export const GROUND = {
  plateTop: P("#EBF0FA", "#1F1F1F"),
  plateEdge: P("#C9D3DF", "#3B484B"),
  /** the built city's ground: its streets, a step under the plate */
  streets: P("#DDE3EC", "#18191B"),
  /** a district's light when the cursor or the camera is on it: the explorer's blue */
  district: P("#0061E2", "#5F9DFF"),
  pad: P("#E3E9F1", "#232629"),
  park: P("#D9E0E8", "#22292D"),
  banks: P("#D9E0E8", "#22292D"),
  water: P("#B9C7D6", "#18212B"),
  waterEdge: P("#9FB0C2", "#243240"),
  current: P("rgba(255,255,255,0.5)", "rgba(120,140,160,0.35)"),
  bridge: P("#F4F6F9", "#2B3036"),
  bridgeEdge: P("#C9D3DF", "#3B484B"),
  blockLip: P("#D3DBE5", "#15171A"),
  blockTop: P("#F7F9FC", "#262A2F"),
  blockEdge: P("rgba(30,40,55,0.12)", "rgba(255,255,255,0.06)"),
  garden: P("#D9E0E8", "#22292D"),
  plotLine: P("rgba(30,40,55,0.08)", "rgba(255,255,255,0.05)"),
  plaza: P("#F7F9FC", "#262A2F"),
  /** downtown's plaza keeps the brand's red as hairlines only: its edge and a dashed ring, no glow */
  plazaEdge: P("rgba(230,33,47,0.35)", "rgba(230,33,47,0.5)"),
  plazaRing: P("rgba(230,33,47,0.18)", "rgba(230,33,47,0.28)"),
  /** a building site's lot, fenced in hairline steel */
  fence: P("rgba(162,175,178,0.9)", "rgba(162,175,178,0.55)"),
  /** a building's soft shade at its foot, the street's at a block's curb, and the ground's under a tree */
  contact: P("rgba(20,32,48,0.16)", "rgba(0,0,0,0.55)"),
  curb: P("rgba(20,32,48,0.18)", "rgba(0,0,0,0.6)"),
  canopy: P("rgba(20,32,48,0.2)", "rgba(0,0,0,0.5)"),
  /** the trees, as a white architectural model's: frost-grey crowns */
  tree: P("#C9D3DF", "#2A3236"),
  trunk: P("#B4BCC2", "#2A3033"),
  roofGarden: P("#D9E0E8", "#22292D"),
  roofTree: P("#C9D3DF", "#2A3236"),
  /** the outskirts' low houses, in the massing's white */
  outskirt: P("#F4F6F9", "#2B3036"),
  /** a building site's stacked materials */
  pile: P("#C9D3DF", "#3B484B"),
};

/** the roofs' furniture: steel and glass, nothing warm */
export const ROOF = {
  cap: P("#EEF1F5", "#30353C"),
  timber: P("#B9C2CA", "#454D55"),
  cone: P("#9AA5AF", "#3B434B"),
  steel: P("#8A969C", "#6E7A80"),
  helipad: P("#5A636D", "#3A4048"),
  solar: P("#3A4A63", "#243044"),
  solarEdge: P("#6F8FC7", "#4F6EA8"),
  warn: P("#E6212F", "#FF394A"),
  crane: P("#A2AFB2", "#A2AFB2"),
};

/** downtown's mark and its lights */
export const HUB3 = {
  mark: P("#E6212F", "#E6212F"),
  flag: P("#E6212F", "#E6212F"),
  strip: P("#FFFFFF", "#EBF0FA"),
};

/** the ledger's tiles by tx family: their tops, read from the map's */
export type { Fam };
export const FAM3 = Object.fromEntries(Object.entries(FAM).map(([f, v]) => [f, pair(v.top)])) as Record<Fam, Pair>;
/** the P-Chain's own ink, for its words: the brand's block gray */
export const P_INK = P("#A2AFB2", "#A2AFB2");

/** the fleet's glass, lamps and paint */
export const FLEET = {
  glass: P("#262B3A", "#0C0D13"),
  lamp: P("#FFF3C4", "#FFF1B0"),
  tail: P("#E6212F", "#FF4D57"),
  box: P("#FBFBFD", "#C9CDD6"),
  beam: P("#FFE7A6", "#FFE7A6"),
  blue: P("#0061E2", "#5F9DFF"),
  /** the model city's paint, for traffic whose sender has no color of its own */
  neutral: [P("#FFFFFF", "#E2E5EC"), P("#C9CED8", "#A3AAB8"), P("#737B8A", "#7B8394"), P("#3B404D", "#555B69")],
  /** a route's paving by its state: off, quiet, busy */
  roadLo: P("#D5DDE7", "#1D2024"),
  roadHi: P("#C3CEDB", "#262B31"),
  mark: P("rgba(255,255,255,0.9)", "rgba(235,240,250,0.35)"),
};

