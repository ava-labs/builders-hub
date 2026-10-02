/* The browser logs every HTTP error a page meets, an expected one too: a
   tx the indexer has not reached yet, an upstream that timed out, a node
   this deployment does not have. A read that sends SOFT_READ's header asks
   a route to answer such a status as 200, with the status in a header:
   statusOf gives the page the status as before, and the console stays
   clean. A read without the header gets the real status, so a route's
   other callers see no change. */

const ASK = "x-soft-status";
const STATUS = "x-status";

/** a read's init: an expected error comes back soft */
export const SOFT_READ = { headers: { [ASK]: "1" } };

/** the status a response stands for: the one a soft answer carries, else its own */
export function statusOf(res: Response): number {
  return Number(res.headers.get(STATUS)) || res.status;
}

/** a success, not a soft answer that stands for an error */
export function isOk(res: Response): boolean {
  return res.ok && !res.headers.get(STATUS);
}

/** an error a page expects and handles: a miss, a refusal, an upstream down */
function expected(status: number): boolean {
  return status === 404 || status === 429 || status >= 500;
}

/** a route's status and headers: an expected error is 200 for a read that asks */
export function softStatus(req: Request, status: number, headers: Record<string, string> = {}): { status: number; headers: Record<string, string> } {
  if (!expected(status) || req.headers.get(ASK) !== "1") return { status, headers };
  // never kept: a cache must not hand the soft answer to a read that did not ask
  return { status: 200, headers: { ...headers, [STATUS]: String(status), "cache-control": "no-store" } };
}
