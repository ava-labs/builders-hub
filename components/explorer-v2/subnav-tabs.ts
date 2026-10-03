import l1ChainsData from "@/constants/l1-chains.json";
import { queryTarget } from "@/lib/explorer-query/target";
import { L1Chain } from "@/types/stats";
import { getExplorerChain } from "@/lib/pchain-explorer";

/* The explorer subnav's section tabs (ExplorerSubnav.tsx draws them). The
   network switch reads them too (network-switch.ts): a section is kept
   across networks only where the other network has its tab. */

/* The network scope's home: every ecosystem-wide facet hangs off it. */
export const NETWORK_HOME = "/explorer/mainnet";
/* the city of every chain, with the explorer's search: one tab from the front door */
const NETWORK_CITY = `${NETWORK_HOME}/chains`;

/** query: the tab opens into recent questions and boards on hover */
export type Tab = {
  label: string;
  /** the name below 1024 px, where the tab's page draws a list and not what its label names */
  phone?: string;
  href: string;
  isActive: (path: string) => boolean;
  query?: boolean;
  /** one of the city and 2D explorer toggle's two views */
  view?: boolean;
};

/* ask the chain a question, get a chart with its SQL; boards live under it */
function queryTab(network: string, chainSlug: string): Tab[] {
  if (!queryTarget(network, chainSlug)) return [];
  const base = `/explorer/${network}/${chainSlug}/query`;
  return [{ label: "Query", href: base, isActive: (p) => p.startsWith(base), query: true }];
}

/* Section tabs per chain kind. Detail pages light up their list's tab
   (a block detail is still "Blocks"); on EVM chains the stats surfaces
   are first-class sections of the same chain, so they ride here too.
   No chain at all is the widest lens: the network scope, where every
   ecosystem-wide facet (chains, ICM, validators, the token) lives. */
export function buildTabs(network: string, chainSlug: string | undefined): Tab[] {
  if (!chainSlug) {
    return [
      {
        // the explorer leads: it is the front door, and the city's card names the two views Explorer and City
        label: "Explorer",
        href: NETWORK_HOME,
        view: true,
        // the network stats live on the overview now
        isActive: (p) => p === NETWORK_HOME || p.startsWith("/stats/overview") || p.startsWith("/stats/network-metrics"),
      },
      {
        // a phone and a small tablet get the chains list, not the city
        label: "City",
        phone: "Chains",
        href: NETWORK_CITY,
        view: true,
        // the network map, ICM and validator versions live on the chains tab; message pages light it too
        isActive: (p) =>
          p.startsWith(NETWORK_CITY) || p.startsWith("/explorer/chains") || p.startsWith(`${NETWORK_HOME}/icm`) || p.startsWith(`${NETWORK_HOME}/validators`),
      },
      {
        label: "AVAX",
        href: `${NETWORK_HOME}/token`,
        isActive: (p) => p.startsWith(`${NETWORK_HOME}/token`),
      },
      {
        // Query at the network scope: a picker on the page names the chain it asks
        label: "Query",
        href: `${NETWORK_HOME}/query`,
        isActive: (p) => p.startsWith(`${NETWORK_HOME}/query`),
      },
    ];
  }

  if (getExplorerChain(chainSlug)?.kind === "pchain") {
    const base = `/explorer/${network}/${chainSlug}`;
    const tabs: Tab[] = [
      {
        label: "Overview",
        href: base,
        isActive: (p) => p === base || p.startsWith(`${base}/address`),
      },
      { label: "Blocks", href: `${base}/blocks`, isActive: (p) => p.startsWith(`${base}/block`) },
      { label: "Transactions", href: `${base}/txs`, isActive: (p) => p.startsWith(`${base}/tx`) },
    ];
    // the staking + L1-economy feeds are mainnet-only AND P-chain-only:
    // the X-chain shares this kind (Overview/Blocks/Transactions) but has
    // no staking surfaces
    if (network === "mainnet" && chainSlug === "p-chain") {
      tabs.push(
        {
          label: "Staking",
          href: `${base}/staking`,
          isActive: (p) => p.startsWith(`${base}/staking`),
        },
        // the OTHER validator economy: ACP-77 seats burn where staking
        // mints: different money, different tab
        {
          label: "L1s",
          href: `${base}/l1s`,
          isActive: (p) => p.startsWith(`${base}/l1s`),
        },
      );
    }
    tabs.push({
      label: "Validators",
      href: `${base}/validators`,
      isActive: (p) => p.startsWith(`${base}/validators`) || p.startsWith(`${base}/node`),
    });
    tabs.push(...queryTab(network, chainSlug));
    return tabs;
  }

  const base = `/explorer/${network}/${chainSlug}`;
  const tabs: Tab[] = [
    {
      label: "Overview",
      href: base,
      isActive: (p) => p === base || p.startsWith(`${base}/address`),
    },
  ];

  // custom chains (localStorage imports) have no stats surfaces
  const catalogChain = (l1ChainsData as L1Chain[]).find((c) => c.slug === chainSlug);
  if (catalogChain) {
    if (catalogChain.rpcUrl) {
      // list tabs mirror the P-Chain's; detail pages light their list
      tabs.push(
        { label: "Blocks", href: `${base}/blocks`, isActive: (p) => p.startsWith(`${base}/block`) },
        // the tab's views: EVM txs, the C-Chain's atomic imports and exports
        // (txs/atomic), ICM messages (txs/icm); atomic detail pages light it too
        { label: "Transactions", href: `${base}/txs`, isActive: (p) => p.startsWith(`${base}/tx`) || p.startsWith(`${base}/atomic-tx`) },
        // the gas market: live half is pure RPC, so any chain with an RPC
        // earns the tab; history fills in where ClickHouse ingests the chain
        { label: "Gas", href: `${base}/gas`, isActive: (p) => p.startsWith(`${base}/gas`) },
        ...queryTab(network, chainSlug),
      );
    }
    if (network === "mainnet" && chainSlug === "c-chain") {
      // protocols and stablecoins: one tab, a switch on the page picks the view
      tabs.push({
        label: "DeFi",
        href: `${base}/defi`,
        isActive: (p) => p.startsWith(`${base}/defi`) || p.startsWith("/stats/dapps"),
      });
    }
    // who's on the chain: population charts for every catalog chain,
    // leaderboards where ClickHouse ingests it
    tabs.push({
      label: "Accounts",
      href: `${base}/accounts`,
      isActive: (p) => p.startsWith(`${base}/accounts`),
    });
    if (catalogChain.isTestnet !== true) {
      // the C-Chain's validators ARE the Primary Network's, so on mainnet
      // the tab also carries their staking economy (validators/staking)
      tabs.push({
        label: "Validators",
        // every chain's set lives in its own chrome: the C-Chain mounts
        // the Primary Network roster, L1s their own weight table
        href: `${base}/validators`,
        isActive: (p) => p.startsWith(`${base}/validators`),
      });
    }
  }
  return tabs;
}
