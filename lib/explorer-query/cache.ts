import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "redis";
import type { ChartSpec, Drill, Turn } from "./types";
import type { VisualSpec } from "./visual";

/* Answers are kept as recipes: the question's SQL, chart, drill and
   layout, never the rows. A hit re-runs the SQL, so the figures are
   always fresh and only the model work is skipped. Recipes live in Redis
   so every instance shares them; without Redis each instance keeps its
   own for as long as it lives. */

export interface Recipe {
  /** the question as asked; the layout stage designs for it */
  question: string;
  title: string;
  note: string;
  sql: string;
  chart: ChartSpec;
  drill: Drill | null;
  visual: VisualSpec | null;
  /** which model wrote the SQL */
  writer: string;
  at: number;
}

const TTL_S = 7 * 24 * 3600;
const PREFIX = "explorer-query:v2:";
const LOCAL_MAX = 500;
const local = new Map<string, Recipe>();

let client: ReturnType<typeof createClient> | null = null;
let connecting: Promise<ReturnType<typeof createClient> | null> | null = null;

async function redis() {
  if (client?.isOpen) return client;
  if (connecting) return connecting;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  connecting = (async () => {
    const c = createClient({ url, socket: { connectTimeout: 1500 } });
    c.on("error", (e) => {
      console.warn("[explorer-query] redis error", e instanceof Error ? e.message : e);
      client = null;
      connecting = null;
    });
    await c.connect();
    client = c;
    return c;
  })().catch(() => {
    connecting = null;
    return null;
  });
  return connecting;
}

/** the same question on the same chain, however it was typed */
export function recipeKey(chainId: number, prompt: string, history: Turn[] = []): string {
  const norm = prompt.toLowerCase().replace(/\s+/g, " ").replace(/[?.!\s]+$/, "").trim();
  const past = history.map((t) => t.sql).join("\n");
  return createHash("sha256").update(`${chainId}\n${norm}\n${past}`).digest("hex").slice(0, 32);
}

export async function getRecipe(key: string): Promise<Recipe | null> {
  const hit = local.get(PREFIX + key);
  if (hit && Date.now() - hit.at < TTL_S * 1000) return hit;
  try {
    const r = await redis();
    const raw = r ? await r.get(PREFIX + key) : null;
    if (!raw) return null;
    const recipe = JSON.parse(raw) as Recipe;
    remember(key, recipe);
    return recipe;
  } catch {
    return null;
  }
}

export async function putRecipe(key: string, recipe: Recipe): Promise<void> {
  remember(key, recipe);
  try {
    const r = await redis();
    if (r) await r.set(PREFIX + key, JSON.stringify(recipe), { EX: TTL_S });
  } catch {
    /* the local copy still serves this instance */
  }
}

/** the layout arrives after the SQL; add it to the recipe already kept.
    Only the server's own design of the recipe's own rows is stored. */
export async function putVisual(key: string, visual: VisualSpec): Promise<void> {
  const recipe = await getRecipe(key);
  if (recipe) await putRecipe(key, { ...recipe, visual: layoutOnly(visual) });
}

/** what outlives the rows it was designed on: panels and stats, never the
    sentences and markers that quote one moment's figures and names */
export function layoutOnly(v: VisualSpec): VisualSpec {
  return {
    ...v,
    stats: v.stats.map(({ sub: _sub, ...s }) => s),
    panels: v.panels.map((p) => ({ ...p, markers: [], bands: [], referenceLines: p.referenceLines.filter((l) => !/\d/.test(l.label) || /limit|target|cap/i.test(l.label)) })),
    callouts: [],
  };
}

function remember(key: string, recipe: Recipe) {
  if (local.size >= LOCAL_MAX) local.delete(local.keys().next().value as string);
  local.set(PREFIX + key, recipe);
}
