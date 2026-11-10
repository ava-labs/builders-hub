import "server-only";
import l1ChainsData from "@/constants/l1-chains.json";
import { isPublicRpcUrl } from "@/lib/explorer-rpc";
import { targetOf } from "./target";

/* A chain's own RPC, and the time of its newest block. Before anchorNow moves now() back to the index's last
   block, it asks the chain: a quiet L1 makes no block for a while, and then its index is not late (the L1 audit
   saw FIFA, 31 blocks a day, read "the last hour" as the hour before its last block). */

const C_CHAIN_PUBLIC = "https://api.avax.network/ext/bc/C/rpc";
const HEAD_TTL_MS = 60_000;
const TIMEOUT_MS = 2_500;

/** the RPC of this chain the server reads: our own node for the C-Chain, else the chain's public RPC; null for a
    chain with none, and for the P-Chain */
export function chainRpc(chainId: number): string | null {
  if (targetOf(chainId).kind === "pchain") return null;
  if (chainId === 43114) return process.env.CCHAIN_DEBUG_RPC_URL || C_CHAIN_PUBLIC;
  const c = (l1ChainsData as { chainId: string; rpcUrl?: string; isTestnet?: boolean }[]).find((x) => x.chainId === String(chainId) && x.isTestnet !== true);
  return c && isPublicRpcUrl(c.rpcUrl) ? c.rpcUrl : null;
}

const heads = new Map<number, { at: number; read: Promise<number | null> }>();

/** the time of the chain's newest block, in ms; null when the chain has no RPC or its RPC does not answer in time.
    One read a minute per chain, shared by every caller; a failed read is kept for the minute too, so an RPC that
    is down costs one timeout a minute, not one a question */
export function headTime(chainId: number): Promise<number | null> {
  const url = chainRpc(chainId);
  if (!url) return Promise.resolve(null);
  const hit = heads.get(chainId);
  if (hit && Date.now() - hit.at < HEAD_TTL_MS) return hit.read;
  const read = fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBlockByNumber", params: ["latest", false] }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  })
    .then(async (res) => {
      const block = res.ok ? ((await res.json()) as { result?: { timestamp?: string } | null }).result : null;
      const t = block?.timestamp ? parseInt(block.timestamp, 16) * 1000 : NaN;
      return Number.isFinite(t) ? t : null;
    })
    .catch(() => null);
  heads.set(chainId, { at: Date.now(), read });
  return read;
}
