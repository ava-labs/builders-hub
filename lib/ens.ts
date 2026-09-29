import { createPublicClient, fallback, getAddress, http, isAddress, type Address } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";

/* ENS names for the explorer: name -> address for search, address -> primary
   name for the address page. ENS lives on Ethereum mainnet, so this runs
   server-side against an Ethereum RPC (ETHEREUM_RPC_URL first, then public
   endpoints). viem goes through the Universal Resolver, which follows
   offchain (CCIP-read) names and checks that a primary name resolves back
   to the same address. An EVM address is the same on every chain, so the
   ETH address record is the one read. */

const PUBLIC_RPCS = ["https://1rpc.io/eth", "https://eth.llamarpc.com", "https://ethereum-rpc.publicnode.com"];

const client = createPublicClient({
  chain: mainnet,
  transport: fallback(
    [process.env.ETHEREUM_RPC_URL, ...PUBLIC_RPCS].filter((u): u is string => !!u).map((u) => http(u, { timeout: 8_000 })),
  ),
});

/** a dotted name ending in .eth, subdomains included */
export const ENS_NAME = /^[^\s./]+(\.[^\s./]+)*\.eth$/i;

const TTL_MS = 10 * 60_000;
const cache = new Map<string, { at: number; value: string | null }>();

async function cached(key: string, load: () => Promise<string | null>): Promise<string | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = await load();
  if (cache.size > 5_000) cache.clear();
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** name.eth -> checksummed address, null when the name has no ETH address.
 *  Throws on an RPC failure, so a miss is never cached as "no address". */
export async function resolveEnsName(name: string): Promise<Address | null> {
  let normalized: string;
  try {
    normalized = normalize(name.trim());
  } catch {
    return null;
  }
  if (!ENS_NAME.test(normalized)) return null;
  const address = await cached(`n:${normalized}`, async () => (await client.getEnsAddress({ name: normalized })) ?? null);
  return address && isAddress(address) ? getAddress(address) : null;
}

/** address -> verified primary name, null when none is set */
export async function lookupEnsName(address: string): Promise<string | null> {
  if (!isAddress(address)) return null;
  return cached(`a:${address.toLowerCase()}`, async () => (await client.getEnsName({ address: getAddress(address) })) ?? null);
}
