/* Where the server's P-Chain reads go. The public RPC rate-limits by IP
   (Cloudflare error 1015), so a read it refuses goes on to our dedicated
   node: the node /api/rpc reads the C-Chain from, which serves the P-Chain
   on the same host and token. After a refusal the public RPC rests for its
   retry-after and reads go straight to the node. The node's URL carries a
   token: import this from server code only. */

const PUBLIC: Record<string, string> = {
  mainnet: "https://api.avax.network/ext/bc/P",
  fuji: "https://api.avax-test.network/ext/bc/P",
};

const NODE_C_CHAIN: Record<string, string | undefined> = {
  mainnet: process.env.CCHAIN_DEBUG_RPC_URL,
  fuji: process.env.FUJI_DEBUG_RPC_URL,
};

/* the dedicated node's P-Chain, from its C-Chain URL */
function nodeUrl(network: string): string | undefined {
  const c = NODE_C_CHAIN[network];
  if (!c) return undefined;
  try {
    const u = new URL(c);
    const path = u.pathname.replace(/\/ext\/(bc\/)?C\/rpc\/?$/, "/ext/bc/P");
    if (path === u.pathname) return undefined;
    u.pathname = path;
    return u.toString();
  } catch {
    return undefined;
  }
}

// per network: the public RPC is not asked again before this time
const restUntil = new Map<string, number>();
const REST_MS = 10 * 60_000;
const REST_MAX_MS = 60 * 60_000;

function rest(network: string, res: Response) {
  const s = Number(res.headers.get("retry-after"));
  restUntil.set(network, Date.now() + (s > 0 ? Math.min(s * 1000, REST_MAX_MS) : REST_MS));
}

/** POST one JSON-RPC body to the network's P-Chain: the public RPC, then the
 *  dedicated node when the public one refuses, fails or is resting. Resolves
 *  to the first ok answer, else the last answer; rejects when none came. */
export async function pchainPost(network: string, body: unknown, timeoutMs: number): Promise<Response> {
  const pub = PUBLIC[network];
  if (!pub) throw new Error(`no P-Chain RPC for network "${network}"`);
  const node = nodeUrl(network);
  const urls = !node ? [pub] : (restUntil.get(network) ?? 0) > Date.now() ? [node] : [pub, node];
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  for (let i = 0; ; i++) {
    const last = i === urls.length - 1;
    try {
      const res = await fetch(urls[i], {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (urls[i] === pub && (res.status === 429 || res.status === 403)) rest(network, res);
      if (res.ok || last) return res;
      await res.body?.cancel();
    } catch (error) {
      if (last) throw error;
    }
  }
}
