/* The Explorer's proxies (app/api/evm, catomic, pchain, xchain) put the
   rest of a request's path after a fixed prefix of the upstream's. A
   segment of that path names one thing under the prefix: a resource, a
   hash, an address. A dot segment, or a segment with a slash in it (a %2F
   in the request, which the upstream reads as a slash again), names a
   place outside the prefix, so the proxy refuses the path. */

/** the characters that end a segment or do not show: a slash, a backslash, a control character */
const LEAVES = /[/\\\u0000-\u001f\u007f]/;

/** the path a proxy asks its upstream for, each segment as one segment there; null when a segment could leave its place */
export function upstreamPath(path: string[] | undefined): string | null {
  const segments = path ?? [];
  if (segments.some((s) => s === "" || s === "." || s === ".." || LEAVES.test(s))) return null;
  return segments.map(encodeURIComponent).join("/");
}

/** the answer to a path the proxy does not forward */
export const BAD_PATH = { body: { error: "invalid path" }, init: { status: 400 } } as const;
