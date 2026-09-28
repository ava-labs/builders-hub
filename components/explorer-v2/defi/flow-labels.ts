import type { GroupKey } from "@/lib/defi/taxonomy";

/* The contract registry's categories, read in the DeFi page's groups so a
   flow wears the same color as its protocols on the other views. */

const GROUP_OF: Record<string, GroupKey> = {
  dex: "dex",
  lending: "lending",
  derivatives: "perps",
  bridge: "bridge",
  icm: "bridge",
  yield: "yield",
  rwa: "rwa",
};

const LABEL: Record<string, string> = {
  dex: "DEXes",
  lending: "Lending",
  derivatives: "Perps & options",
  bridge: "Bridges",
  icm: "Interchain messaging",
  yield: "Yield",
  rwa: "Real-world assets",
  nft: "NFTs",
  gaming: "Gaming",
  other: "Other",
  wallet: "Wallets",
};

export const flowGroup = (category: string): GroupKey => GROUP_OF[category] ?? "other";
export const flowLabel = (category: string): string => LABEL[category] ?? category.charAt(0).toUpperCase() + category.slice(1);

/** what a move is, read from the protocol's category and the direction */
export function actionOf(category: string | null, direction: "in" | "out" | "between"): string {
  if (direction === "between") return "Protocol to protocol";
  switch (category) {
    case "lending":
    case "yield":
    case "rwa":
    case "derivatives":
      return direction === "in" ? "Deposit" : "Withdrawal";
    case "bridge":
    case "icm":
      return direction === "in" ? "Sent to bridge" : "From bridge";
    case "dex":
      return "Trade or liquidity";
    default:
      return "Transfer";
  }
}
