import { prisma } from "@/prisma/prisma";
import l1ChainsData from "@/constants/l1-chains.json";
import { boardHref, playgroundBoardId } from "@/lib/explorer-query/board-links";
import { boardIdSchema, scopeSchema } from "@/lib/explorer-query/board-wire";
import { MAX_TILES } from "@/lib/explorer-query/board-limits";
import { isMetricKey, METRIC_CHAIN } from "@/lib/explorer-query/stats-metrics";

/* The Query boards of one user, in every scope, for the profile. A
   Playground dashboard that has not come over to a board yet shows as the
   board it becomes: Query makes that board when the owner opens its link
   (lib/explorer-query/playground.ts). Read-only: the Query pages write. */

/** one board as the profile lists it */
export interface ProfileBoard {
  id: string;
  name: string;
  /** network:chain, e.g. mainnet:c-chain */
  scope: string;
  network: string;
  /** the chain's slug in explorer paths */
  chain: string;
  chainLabel: string;
  networkLabel: string;
  /** every tile, notes included */
  tiles: number;
  /** the tiles that draw a chart */
  charts: number;
  /** ISO time */
  updatedAt: string;
  href: string;
}

export interface ProfileBoards {
  boards: ProfileBoard[];
}

/** the most boards the profile lists */
export const MAX_PROFILE_BOARDS = 200;
/** dashboards Query reads per owner: GET /api/playground lists the newest 100, and only those come over */
const DASHBOARDS_READ = 100;
/** where a dashboard's board goes (PLAYGROUND_SCOPE in playground.ts) */
const PLAYGROUND_NETWORK = "mainnet";
const PLAYGROUND_CHAIN = "c-chain";
const PLAYGROUND_SCOPE = `${PLAYGROUND_NETWORK}:${PLAYGROUND_CHAIN}`;
const UNTITLED = "Untitled board";

const PRIMARY_CHAINS: Record<string, string> = { "c-chain": "C-Chain", "p-chain": "P-Chain", "x-chain": "X-Chain" };
const NETWORKS: Record<string, string> = { mainnet: "Mainnet", fuji: "Fuji", testnet: "Fuji" };

type CatalogChain = { slug: string; chainName?: string; isTestnet?: boolean };
const CATALOG = l1ChainsData as CatalogChain[];

/** the chain's name: the Primary Network's chains by letter, an L1 by its catalog name */
export function chainLabelOf(network: string, slug: string): string {
  const primary = PRIMARY_CHAINS[slug];
  if (primary) return primary;
  const testnet = network !== "mainnet";
  const entry =
    CATALOG.find((c) => c.slug === slug && Boolean(c.isTestnet) === testnet) ?? CATALOG.find((c) => c.slug === slug);
  return entry?.chainName?.trim() || slug;
}

export function networkLabelOf(network: string): string {
  return NETWORKS[network] ?? network;
}

type Loose = Record<string, unknown>;
const isObj = (v: unknown): v is Loose => !!v && typeof v === "object" && !Array.isArray(v);

/* How many charts a dashboard's board gets: 0 when it gets no board.
   The same test as boardFromPlayground in playground.ts, which cannot load
   here (its store needs the browser): a chart draws when one of its series
   is shown, on a chain and of a metric the stats API has. */
export function playgroundCharts(raw: unknown): number {
  const charts = Array.isArray(raw) ? raw : isObj(raw) && Array.isArray(raw.charts) ? raw.charts : [];
  const drawn = charts.filter(
    (c) =>
      isObj(c) &&
      Array.isArray(c.dataSeries) &&
      c.dataSeries.some(
        (s) =>
          isObj(s) &&
          s.visible !== false &&
          typeof s.chainId === "string" &&
          METRIC_CHAIN.test(s.chainId) &&
          isMetricKey(s.metricKey),
      ),
  ).length;
  return Math.min(drawn, MAX_TILES);
}

/* A board's link is built from its scope and id, so both must be ones the
   board routes accept: that keeps the path inside Query, and leaves out a
   board (or a dashboard's board) that no page can open. */
const linkable = (scope: string, id: string) =>
  scopeSchema.safeParse(scope).success && boardIdSchema.safeParse(id).success;

function entry(id: string, scope: string, name: string, tiles: number, charts: number, updatedAt: Date): ProfileBoard {
  const cut = scope.indexOf(":");
  const network = scope.slice(0, cut);
  const chain = scope.slice(cut + 1);
  return {
    id,
    name: name.trim() || UNTITLED,
    scope,
    network,
    chain,
    chainLabel: chainLabelOf(network, chain),
    networkLabel: networkLabelOf(network),
    tiles,
    charts,
    updatedAt: updatedAt.toISOString(),
    href: boardHref(network, chain, id),
  };
}

export async function getProfileBoards(userId: string): Promise<ProfileBoards> {
  const [live, dashboards] = await Promise.all([
    prisma.queryBoard.findMany({
      where: { user_id: userId, deleted_at: null },
      select: { id: true, scope: true, name: true, tiles: true, updated_at: true },
      orderBy: { updated_at: "desc" },
      take: MAX_PROFILE_BOARDS,
    }),
    prisma.statsPlayground.findMany({
      where: { user_id: userId },
      select: { id: true, name: true, charts: true, updated_at: true },
      orderBy: { updated_at: "desc" },
      take: DASHBOARDS_READ,
    }),
  ]);

  const boards = live
    .filter((b) => linkable(b.scope, b.id))
    .map((b) => {
      const tiles = Array.isArray(b.tiles) ? b.tiles : [];
      const charts = tiles.filter((t) => !(isObj(t) && t.kind === "note")).length;
      return entry(b.id, b.scope, b.name, tiles.length, charts, b.updated_at);
    });

  // the boards these dashboards become, deleted ones too: a dashboard whose
  // board the user deleted never comes back. Only these ids, so the read
  // stays bounded as the kept deletes grow.
  const wanted = [...new Set(dashboards.map((d) => playgroundBoardId(d.id)))];
  const made = wanted.length
    ? await prisma.queryBoard.findMany({
        where: { user_id: userId, scope: PLAYGROUND_SCOPE, id: { in: wanted } },
        select: { id: true },
      })
    : [];

  const known = new Set(made.map((b) => b.id));
  for (const d of dashboards) {
    const id = playgroundBoardId(d.id);
    if (known.has(id)) continue;
    known.add(id);
    const charts = playgroundCharts(d.charts);
    if (charts === 0 || !linkable(PLAYGROUND_SCOPE, id)) continue;
    boards.push(entry(id, PLAYGROUND_SCOPE, d.name.trim().slice(0, 80), charts, charts, d.updated_at));
  }

  boards.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return { boards: boards.slice(0, MAX_PROFILE_BOARDS) };
}
