/* What a link to an answer shows where it is pasted: the title, the
   description and the share image's URL, from the chain, the question and
   the answer's recipe when one is kept. No React and no server import here,
   so the rules are pinned by tests (tests/unit/explorer/query-share.test.ts).
   share-answer.ts finds the recipe; app/api/og/query draws the image. */

import l1ChainsData from "@/constants/l1-chains.json";
import type { Recipe } from "./cache";
import { NETWORK_ID, NETWORK_SLUG, queryTarget } from "./target";

/** the most characters of a question a link's card reads */
export const QUESTION_MAX = 300;
/** the most characters of a question a card shows as its title */
export const TITLE_MAX = 80;
const DESCRIPTION_MAX = 200;

/** the card of a link that names no chain or no question the page can ask */
export const GENERIC_CARD = { title: "Query", description: "Ask an Avalanche chain a question in plain words and get a chart with its SQL." };

export interface ShareChain {
  slug: string;
  /** the chain_id the question is asked of */
  chainId: number;
  /** as a label: "C-Chain", "All chains" */
  name: string;
  /** mid-sentence: "the C-Chain", "every chain" */
  subject: string;
}

/** the chain a mainnet Query link asks, by its slug; null for Fuji, and for a slug the Query page has no chain for */
export function shareChain(network: string, slug: string | undefined): ShareChain | null {
  if (network !== "mainnet" || !slug) return null;
  if (slug === NETWORK_SLUG) return { slug, chainId: NETWORK_ID, name: "All chains", subject: "every chain" };
  const target = queryTarget(network, slug);
  if (!target) return null;
  if (target.kind === "pchain") return { slug, chainId: target.chainId, name: "P-Chain", subject: "the P-Chain" };
  if (slug === "c-chain") return { slug, chainId: target.chainId, name: "C-Chain", subject: "the C-Chain" };
  const chain = (l1ChainsData as { slug: string; chainName: string; isTestnet?: boolean }[]).find((c) => c.slug === slug && c.isTestnet !== true);
  return chain ? { slug, chainId: target.chainId, name: chain.chainName, subject: chain.chainName } : null;
}

/** text cut at a number of characters, the last one an ellipsis; the cut falls between words when a space is near */
function cutAt(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max - 1);
  const space = head.lastIndexOf(" ");
  return `${(/\s/.test(text[max - 1]) || space < max - 16 ? head : head.slice(0, space)).trimEnd()}\u2026`;
}

/** a link's question as the card reads it: one line, no control characters, QUESTION_MAX characters at most; null when
    the link has none */
export function askedOf(raw: unknown): string | null {
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (typeof first !== "string") return null;
  const line = first
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\ufeff]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, QUESTION_MAX)
    .trimEnd();
  return line || null;
}

/** the share image of a question asked of a chain */
export function shareImageUrl(slug: string, question: string): string {
  return `/api/og/query/mainnet/${encodeURIComponent(slug)}?q=${encodeURIComponent(question.slice(0, QUESTION_MAX))}&v=1`;
}

/** what a link to an answer shows: the recipe's title and note when the answer is kept or fixed, else the question
    and a line that says what Query is */
export function shareCard(chain: ShareChain, question: string, recipe: Pick<Recipe, "title" | "note"> | null): { title: string; description: string; imageUrl: string } {
  const title = (typeof recipe?.title === "string" && recipe.title.trim()) || cutAt(question, TITLE_MAX);
  const note = typeof recipe?.note === "string" ? recipe.note.trim() : "";
  return {
    title,
    description: note ? cutAt(note, DESCRIPTION_MAX) : `A question asked of ${chain.subject} on the Avalanche Explorer. Query answers it with a chart and its SQL.`,
    imageUrl: shareImageUrl(chain.slug, question),
  };
}

/** the shape of an answer, as the share image draws it: a panel kind of the layout, or "ask" for a question with no
    recipe */
export const SHAPE_LABEL = {
  hbar: "Ranking",
  bar: "Bars",
  line: "Series",
  area: "Series",
  scatter: "Scatter",
  flow: "Flow",
  dumbbell: "Before and now",
  diverging: "Above and below zero",
  histogram: "Spread",
  heatmap: "Heatmap",
  treemap: "Parts of a whole",
  table: "Table",
  ask: "Question",
} as const;
export type ShareShape = keyof typeof SHAPE_LABEL;

const isShape = (kind: unknown): kind is ShareShape => typeof kind === "string" && kind !== "ask" && kind in SHAPE_LABEL;

/** the shape a recipe's layout names: its first panel that is not a table, else its chart's kind. A kept recipe is
    read from a store, so every field is checked */
export function shapeOf(recipe: Pick<Recipe, "chart" | "visual"> | null): ShareShape {
  if (!recipe) return "ask";
  const panels = Array.isArray(recipe.visual?.panels) ? recipe.visual.panels : [];
  const kind = (panels.find((p) => isShape(p?.kind) && p.kind !== "table") ?? panels[0])?.kind ?? recipe.chart?.kind;
  return isShape(kind) ? kind : "table";
}

/** the image's title sizes, largest first, in pixels */
const TITLE_SIZES = [76, 64, 54, 46];

/** a character's width in the title face, in ems; a rough figure on the wide side, so a line never runs past its box */
function emOf(ch: string): number {
  if (ch.charCodeAt(0) > 0x2e7f) return 1.05;
  if (/[ iljtfr.,:;'|!()[\]]/.test(ch)) return 0.36;
  if (/[mwMW@%]/.test(ch)) return 0.92;
  if (/[A-Z0-9]/.test(ch)) return 0.7;
  return 0.58;
}
const emsOf = (text: string) => [...text].reduce((sum, ch) => sum + emOf(ch), 0);

/** text as lines no wider than a number of ems: words stay whole, and a word wider than a line breaks */
function wrap(text: string, ems: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    let rest = word;
    while (emsOf(rest) > ems) {
      if (line) lines.push(line);
      let head = "";
      for (const ch of rest) {
        if (emsOf(head + ch) > ems) break;
        head += ch;
      }
      head ||= [...rest][0];
      lines.push(head);
      line = "";
      rest = rest.slice(head.length);
    }
    if (!rest) continue;
    const joined = line ? `${line} ${rest}` : rest;
    if (emsOf(joined) <= ems) line = joined;
    else {
      lines.push(line);
      line = rest;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** the image's title: the largest size at which it fits a box of a width in pixels on 3 lines; at the smallest size
    a longer title ends its third line with an ellipsis */
export function titleLines(title: string, width: number, max = 3): { size: number; lines: string[] } {
  for (const size of TITLE_SIZES) {
    const lines = wrap(title, width / size);
    if (lines.length <= max) return { size, lines };
  }
  const size = TITLE_SIZES[TITLE_SIZES.length - 1];
  const lines = wrap(title, width / size).slice(0, max);
  let last = [...lines[max - 1]];
  while (last.length > 1 && emsOf(`${last.join("")}…`) > width / size) last = last.slice(0, -1);
  lines[max - 1] = `${last.join("").trimEnd()}…`;
  return { size, lines };
}
