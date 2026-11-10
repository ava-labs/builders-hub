import { buildTabs, networkHome } from "@/components/explorer-v2/subnav-tabs";
import { MAINNET_COUNTERPART, TESTNET_COUNTERPART, resolveCatalogChain, wantsTestnet } from "@/lib/explorer-catalog";
import { getExplorerChain } from "@/lib/pchain-explorer";

/* Where a switch lands. The Mainnet/Fuji switch (a chain to its counterpart)
   and the chain switch (one chain to another, or to the network scope) share
   these rules:
   - The same page where the target serves it: a tab's list, or a view below
     it (gas/base-fee, query/boards). SAME_PAGE names a page with two paths.
   - An entity page (a block, tx, address or node) lands on its tab's list,
     because its id means nothing on the target. A board lands on the boards
     list, because a board belongs to one scope.
   - A tab the target does not have, or a page that lights no tab (genesis,
     an X-Chain asset), lands on the target's home. Staking and L1s land on
     Validators, where Fuji's Staking and L1s routes redirect.
   - A switch to the scope the reader is on links to the page itself.
   - The network scope runs on both networks. AVAX and Query are mainnet's,
     so a switch from them lands on the Fuji home. The City keeps its open
     chain where the other network has it (cityChainOn). */

/* Views below a tab's list that only some targets serve. Elsewhere their URL
   is a 404 or a redirect, so the switch lands on the tab's list. */
const SERVED_ONLY_BY: Record<string, (network: string, chain: string | undefined) => boolean> = {
  "txs/atomic": (_network, chain) => chain === "c-chain",
  // the P-Chain and X-Chain have no ICM view
  "txs/icm": (_network, chain) => chain !== undefined && !getExplorerChain(chain),
  "validators/staking": (network, chain) => network === "mainnet" && chain === "c-chain",
  "validators/l1s": (_network, chain) => chain === "p-chain",
  // the network scope's Query has no boards
  "query/boards": (_network, chain) => chain !== undefined,
};

/* One page under two paths: the Primary Network's staking economy is the
   P-Chain's Staking tab and a view of the C-Chain's Validators tab. */
const SAME_PAGE: [string, string][] = [["staking", "validators/staking"]];

const under = (path: string, head: string) => path === head || path.startsWith(`${head}/`);

function scopeBase(network: string, chain: string | undefined): string {
  return chain ? `/explorer/${network}/${chain}` : networkHome(network);
}

/** The target of a switch from `pathname` (on `fromChain`, or the network scope) to `chain` on `network`. */
export function switchTarget(pathname: string, fromChain: string | undefined, network: string, chain: string | undefined): string {
  const parts = pathname.split("/").filter(Boolean);
  const fromNetwork = parts[1] ?? network;
  const fromBase = scopeBase(fromNetwork, fromChain);
  const base = scopeBase(network, chain);
  // the row of the page the reader is on links to that page
  if (base === fromBase) return pathname;
  // the path below the scope; the URL's chain segment can differ from the chain's slug (beam for beam-l1 on Fuji)
  const rest = parts.slice(fromChain ? 3 : 2).join("/");
  if (!rest) return base;
  const tab = buildTabs(fromNetwork, fromChain).find((t) => t.isActive(`${fromBase}/${rest}`));
  if (!tab) return base;
  const section = tab.href.slice(fromBase.length + 1);
  // a block page lights the Blocks tab but sits beside its list, not below it; a board belongs to one scope
  const page = section && under(rest, section) ? rest.replace(/^query\/boards\/.+/, "query/boards") : section;
  const aliases = SAME_PAGE.flatMap((pair) =>
    pair.flatMap((from, i) => (under(page, from) ? [pair[1 - i] + page.slice(from.length)] : [])),
  );
  const fallback = section === "staking" || section === "l1s" ? ["validators"] : [];

  const tabs = buildTabs(network, chain);
  const served = (path: string) =>
    tabs.some((t) => t.href === `${base}/${path.split("/")[0]}`) &&
    Object.entries(SERVED_ONLY_BY).every(([view, serves]) => !under(path, view) || serves(network, chain));
  const landing = [page, ...aliases, section, ...fallback].find((path) => path && served(path));
  return landing ? `${base}/${landing}` : base;
}

/** The slug of `chain` on Fuji: the P- and X-Chain keep their slug, and an L1 takes the slug of its Fuji catalog entry.
 *  That entry is the chain itself (beam-l1, kula-testnet) or its counterpart (beam-l1 for beam). Any other chain gives
 *  undefined: Fuji does not have it. */
function fujiSlugOf(chain: string): string | undefined {
  if (getExplorerChain(chain)) return chain;
  const entry = resolveCatalogChain("fuji", chain);
  return entry?.isTestnet === true ? entry.slug : undefined;
}

/** The chain switch keeps the network where the chain runs on it: the network scope and the C-, P- and X-Chain run on
 *  both, and an L1 runs on Fuji under its Fuji slug (fujiSlugOf). Any other L1 is mainnet's. */
export function chainSwitchTarget(pathname: string, fromChain: string | undefined, network: string, chain: string | undefined): string {
  if (!chain) return switchTarget(pathname, fromChain, network, undefined);
  const fujiSlug = wantsTestnet(network) ? fujiSlugOf(chain) : undefined;
  return fujiSlug ? switchTarget(pathname, fromChain, network, fujiSlug) : switchTarget(pathname, fromChain, "mainnet", chain);
}

/** The City's open chain (its ?chain= key) on `network`, the network the switch goes to. The P-Chain and the C-Chain
 *  run on both networks, and an L1 with a counterpart runs on the other network under that slug (beam-l1 for beam).
 *  Any other key gives undefined: the other network does not have that chain. */
export function cityChainOn(key: string, network: string): string | undefined {
  if (key === "p-chain") return key;
  const pairs = wantsTestnet(network) ? TESTNET_COUNTERPART : MAINNET_COUNTERPART;
  // the key comes from the URL: read only the table's own entries, never a name such as "constructor"
  return Object.hasOwn(pairs, key) ? pairs[key] : undefined;
}
