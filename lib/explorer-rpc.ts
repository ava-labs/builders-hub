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
