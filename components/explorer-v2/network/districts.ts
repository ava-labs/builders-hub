/* The city's districts. A chain lives in the district of what it is for,
   read from its category in the catalog (constants/l1-chains.json).
   Downtown is the Primary Network. A chain the catalog does not describe
   yet stands on the Frontier, as does every new L1 until the catalog
   knows it. The order is the city's, clockwise on screen from the
   boulevard behind downtown: Finance faces the viewer, and the Frontier
   is the city's far edge. */

export type District = "gaming" | "culture" | "enterprise" | "finance" | "ai" | "infrastructure" | "frontier";

export const DISTRICTS: { key: District; label: string; about: string }[] = [
  { key: "gaming", label: "Gaming", about: "Game worlds and their economies" },
  { key: "culture", label: "Culture", about: "Sports, music, media and fans" },
  { key: "enterprise", label: "Enterprise", about: "Industry, identity, loyalty and telecom" },
  { key: "finance", label: "Finance", about: "Payments, trading, settlement and real-world assets" },
  { key: "ai", label: "AI", about: "Agents, models and the data they learn from" },
  { key: "infrastructure", label: "Infrastructure", about: "Data, connectivity and general-purpose chains" },
  { key: "frontier", label: "Frontier", about: "L1s the directory does not describe yet, and the week's new L1s" },
];

/** the district that faces the viewer */
export const FRONT: District = "finance";

const BY_CATEGORY: Record<string, District> = {
  Gaming: "gaming",
  Finance: "finance",
  Enterprise: "enterprise",
  Trade: "enterprise",
  Automotive: "enterprise",
  Energy: "enterprise",
  Telecom: "enterprise",
  Loyalty: "enterprise",
  Sports: "culture",
  Music: "culture",
  Media: "culture",
  Collectibles: "culture",
  SocialFi: "culture",
  Ticketing: "culture",
  Fitness: "culture",
  AI: "ai",
  Infrastructure: "infrastructure",
  General: "infrastructure",
};

export function districtOf(category: string | null | undefined): District {
  return (category && BY_CATEGORY[category]) || "frontier";
}

export const districtLabel = (d: District) => DISTRICTS.find((x) => x.key === d)?.label ?? d;
export const districtAbout = (d: District) => DISTRICTS.find((x) => x.key === d)?.about ?? "";
