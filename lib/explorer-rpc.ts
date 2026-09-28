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
