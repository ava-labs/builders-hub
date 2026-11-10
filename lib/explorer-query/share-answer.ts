import "server-only";
import type { Metadata } from "next";
import { createMetadata } from "@/utils/metadata";
import { getRecipe, recipeKey, type Recipe } from "./cache";
import { fixedRecipe, fixedRoute } from "./fixed";
import { askedOf, shareCard, shareChain, type ShareChain } from "./share";

/* The recipe behind a link to an answer, for the link's metadata and its
   share image. A suggestion's is fixed and in memory; a typed question's
   is the one kept when it was answered (one Redis read). No model is asked
   and no chain data is read: a link with no recipe shows its question. */

/** the longest the kept recipe is waited for; a slow or absent store gives the question */
const KEPT_MS = 700;
/** the most follow-ups a link's address keeps */
const THEN_MAX = 8;

async function keptRecipe(chainId: number, question: string): Promise<Recipe | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), KEPT_MS);
  });
  try {
    return await Promise.race([getRecipe(recipeKey(chainId, question)), late]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** the chain a mainnet link's question is answered on and its recipe, or null for a link the page cannot ask. A
    suggestion of the other chain (a P-Chain one asked of the C-Chain) goes to that chain, as on the page */
export async function sharedAnswer(network: string, slug: string | undefined, question: string): Promise<{ chain: ShareChain; recipe: Recipe | null } | null> {
  const asked = shareChain(network, slug);
  if (!asked) return null;
  try {
    const route = fixedRoute(asked.chainId, question);
    const chain = (route && shareChain(network, route)) || asked;
    return { chain, recipe: fixedRecipe(chain.chainId, question) ?? (await keptRecipe(chain.chainId, question)) };
  } catch {
    return { chain: asked, recipe: null };
  }
}

/** the metadata of a Query page opened on an answer link (?q=): the title, note and share image of the answer to the
    link's question (a follow-up changes none of them). Null for a page with no question, for Fuji and for a chain
    Query cannot ask: the page keeps the metadata it has */
export async function answerMetadata(a: { network: string; slug: string | undefined; q: unknown; then?: unknown; path: string; params?: Record<string, string> }): Promise<Metadata | null> {
  const question = askedOf(a.q);
  const answer = question ? await sharedAnswer(a.network, a.slug, question) : null;
  if (!question || !answer) return null;
  const card = shareCard(answer.chain, question, answer.recipe);
  const image = { url: card.imageUrl, width: 1200, height: 630, alt: card.title };
  // the link's own address: the question and its follow-ups, so a share of it opens the same thread
  const link = new URLSearchParams({ ...a.params, q: question });
  for (const t of (Array.isArray(a.then) ? a.then : [a.then]).slice(0, THEN_MAX)) {
    const followUp = askedOf(t);
    if (followUp) link.append("then", followUp);
  }
  return createMetadata({
    title: `${card.title} | Avalanche Explorer`,
    description: card.description,
    openGraph: { title: card.title, description: card.description, url: `${a.path}?${link}`, images: image },
    twitter: { title: card.title, description: card.description, images: image },
  });
}
