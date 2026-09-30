import { decodeFunctionResult, encodeFunctionData, multicall3Abi, type Hex } from "viem";

/* Where the explorer's browser reads go. The C-Chain and Fuji read from our
   dedicated node (archive, trace, no batch limit) through the same-origin
   /api/rpc proxy, so its token never reaches the browser. Every other chain
   keeps its own public RPC. Wallet prompts (add network) still hand out the
   public URL: this is for reads only. */

const DEDICATED = new Set(["43114", "43113"]);

export function readRpc(chainId: string | number | undefined, publicUrl: string | undefined): string | undefined {
  if (chainId !== undefined && DEDICATED.has(String(chainId))) return `/api/rpc/${chainId}`;
  return publicUrl;
}

/* Multicall3 at its canonical address, deployed on the C-Chain and Fuji.
   On those two chains a fan-out of eth_calls (balanceOf across a token set,
   symbol and decimals across unlisted tokens) goes out as aggregate3 calls,
   so the node sees one eth_call per chunk instead of one per read. */

export const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";

/* The proxy caps a request body at 64 KB. One balanceOf entry is 224 bytes
   (448 hex characters) of calldata, so 100 entries keep one aggregate3 near 45 KB. */
const MULTICALL_MAX = 100;

/** whether this read URL is the dedicated C-Chain or Fuji proxy, where Multicall3 is deployed */
export function hasMulticall3(rpcUrl: string | undefined): boolean {
  if (!rpcUrl) return false;
  for (const id of DEDICATED) if (rpcUrl === `/api/rpc/${id}`) return true;
  return false;
}

/** calldata for Multicall3.getEthBalance(addr): the native balance as an eth_call return */
export function ethBalanceCall(addr: string): { to: string; data: string } {
  return { to: MULTICALL3, data: encodeFunctionData({ abi: multicall3Abi, functionName: "getEthBalance", args: [addr as Hex] }) };
}

/** Run eth_calls through Multicall3.aggregate3 with allowFailure, in chunks of
 *  MULTICALL_MAX sent as one JSON-RPC batch. Results come back in request
 *  order: the return data of each call, or null where that call reverted,
 *  the same shape a batch of plain eth_calls gives. Throws when the request
 *  or a whole chunk fails. */
export async function multicall3(
  rpcUrl: string,
  calls: { to: string; data: string }[],
  signal: AbortSignal,
): Promise<(string | null)[]> {
  if (!calls.length) return [];
  const chunks: (typeof calls)[] = [];
  for (let i = 0; i < calls.length; i += MULTICALL_MAX) chunks.push(calls.slice(i, i + MULTICALL_MAX));
  const body = chunks.map((chunk, id) => ({
    jsonrpc: "2.0",
    id,
    method: "eth_call",
    params: [
      {
        to: MULTICALL3,
        data: encodeFunctionData({
          abi: multicall3Abi,
          functionName: "aggregate3",
          args: [chunk.map((c) => ({ target: c.to as Hex, allowFailure: true, callData: c.data as Hex }))],
        }),
      },
      "latest",
    ],
  }));
  const res = await fetch(rpcUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const out = (await res.json()) as { id: number; result?: Hex | null }[];
  const byId = new Map(out.map((r) => [r.id, r.result ?? null]));
  return chunks.flatMap((chunk, id) => {
    const raw = byId.get(id);
    if (!raw) throw new Error("multicall failed");
    const results = decodeFunctionResult({ abi: multicall3Abi, functionName: "aggregate3", data: raw });
    return chunk.map((_, i) => (results[i]?.success ? results[i].returnData : null));
  });
}

/* A catalog RPC that a public page can call without the reader asking:
   https, on a name the internet resolves. A cluster-internal name
   (.local), a private address or a bare host makes Chrome ask the reader
   for access to their local network. A custom chain's own RPC (a
   builder's local node) is not held to this: its reader asked for it. */
export function isPublicRpcUrl(url: string | undefined): url is string {
  if (!url) return false;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== "https:" || host.startsWith("[") || !host.includes(".")) return false;
  if (/(^|\.)(localhost|local|internal|lan|home\.arpa)$/.test(host)) return false;
  const ip = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(host);
  if (!ip) return true;
  const [a, b] = [Number(ip[1]), Number(ip[2])];
  return !(a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127));
}
