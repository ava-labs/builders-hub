/* Where boards and questions live, as paths. No hooks and no store, so a
   server page (a board's link, its metadata) can build them too. */

/** which boards a page sees: a board's SQL is bound to one chain on one network */
export function boardScope(network: string, chainSlug: string): string {
  return `${network}:${chainSlug}`;
}

export function boardsHref(network: string, chainSlug: string): string {
  return `/explorer/${network}/${chainSlug}/query/boards`;
}
export function boardHref(network: string, chainSlug: string, id: string): string {
  return `${boardsHref(network, chainSlug)}/${id}`;
}
/** the Query page on a question, and the follow-ups that refined it */
export function askHref(network: string, chainSlug: string, q?: string, then: string[] = []): string {
  const base = `/explorer/${network}/${chainSlug}/query`;
  if (!q) return base;
  const qs = new URLSearchParams({ q });
  for (const t of then) qs.append("then", t);
  return `${base}?${qs.toString().replace(/\+/g, "%20")}`;
}
