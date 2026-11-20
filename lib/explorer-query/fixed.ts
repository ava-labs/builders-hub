import l1ChainsData from "@/constants/l1-chains.json";
import type { Recipe } from "./cache";
import { CCHAIN } from "./fixed/cchain";
import { L1 } from "./fixed/l1";
import { NETWORK } from "./fixed/network";
import { PCHAIN } from "./fixed/pchain";
import { expandMacros } from "./macros";
import { NETWORK_ID } from "./target";
import type { ChartSpec, Drill } from "./types";
import type { VisualSpec } from "./visual-spec";

/* The suggested questions' answers, fixed: the SQL, chart, drill and
   layout of each one, kept in fixed/ (one file for each page) so a click
   on a suggestion runs its SQL at once and asks no model, for the layout
   either. A question typed another way, or a follow-up, still goes to the
   model. Every mainnet L1 shares one set, filled in with its own chain id
   and token. */

export interface Fixed {
  q: string;
  title: string;
  note: string;
  sql: string;
  chart: ChartSpec;
  drill: Drill | null;
  visual: VisualSpec | null;
  /** three questions a reader may ask next about this answer; a model answers them */
  followups?: string[];
}

/** a question as recipeKey reads it: case, spacing and a closing mark do not matter */
const norm = (q: string) => q.toLowerCase().replace(/\s+/g, " ").replace(/[?.!\s]+$/, "").trim();

const BY_CHAIN = new Map<number, Map<string, Fixed>>([
  [43114, new Map(CCHAIN.map((f) => [norm(f.q), f]))],
  [1, new Map(PCHAIN.map((f) => [norm(f.q), f]))],
  [NETWORK_ID, new Map(NETWORK.map((f) => [norm(f.q), f]))],
]);
const BY_L1 = new Map(L1.map((f) => [norm(f.q), f]));

/* the chains the L1 set answers: each numeric chain id the catalog lists on mainnet and never on Fuji, but the
   C-Chain's. A Fuji L1's suggestions go to the model as they did */
const idsOn = (testnet: boolean) =>
  new Set((l1ChainsData as { chainId: string | number; isTestnet?: boolean }[]).filter((c) => (c.isTestnet === true) === testnet && /^\d+$/.test(String(c.chainId))).map((c) => Number(c.chainId)));
const FUJI_IDS = idsOn(true);
const MAINNET_L1S = new Set([...idsOn(false)].filter((id) => id !== 43114 && !FUJI_IDS.has(id)));

/** a drill's fee column, in the chain's own token: fee_gun on Gunzilla */
const feeColumn = (symbol: string) => `fee_${symbol.toLowerCase().replace(/[^a-z0-9]/g, "") || "native"}`;

/** a suggestion's fixed answer on mainnet, as a recipe; null for any other question or chain. An L1's is filled in
    with the asked chain's id and token. The SQL runs as it leaves here, with no guard before it, so a shorthand it
    opens with ($DEX, $LEND, $LIQUIDATIONS) is written out here as the guard writes it out for a query the model wrote.
    The drill keeps its shorthand, as a model's does: the route writes it out when a row opens (drillSql), and a
    window button moves the drill's window in the text as typed (window-ops.ts) */
export function fixedRecipe(chainId: number, prompt: string, symbol = ""): Recipe | null {
  const own = BY_CHAIN.get(chainId)?.get(norm(prompt));
  const f = own ?? (MAINNET_L1S.has(chainId) ? BY_L1.get(norm(prompt)) : undefined);
  if (!f) return null;
  const fill = (sql: string) => (own ? sql : sql.replaceAll("{chain}", String(chainId)).replaceAll("{fee}", feeColumn(symbol)));
  const written = expandMacros(fill(f.sql), chainId);
  return {
    question: f.q,
    title: f.title,
    note: f.note,
    // a shorthand that cannot be written out leaves the SQL as typed: it fails on the database, and the model answers
    sql: written.ok ? written.sql : fill(f.sql),
    chart: f.chart,
    drill: f.drill && { ...f.drill, sql: fill(f.drill.sql) },
    visual: f.visual,
    writer: "fixed SQL",
    at: 0,
    ...(f.followups ? { followups: f.followups } : {}),
  };
}

/** the chain a suggestion's fixed answer belongs to, when it is the other one: a P-Chain suggestion asked of the C-Chain */
export function fixedRoute(chainId: number, prompt: string): "p-chain" | "c-chain" | null {
  if (chainId === 43114 && BY_CHAIN.get(1)!.has(norm(prompt))) return "p-chain";
  if (chainId === 1 && BY_CHAIN.get(43114)!.has(norm(prompt))) return "c-chain";
  return null;
}
