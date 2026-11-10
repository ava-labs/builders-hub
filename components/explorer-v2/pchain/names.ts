import l1ChainsData from "@/constants/l1-chains.json";
import type { L1Chain } from "@/types/stats";
import { knownChainName } from "@/lib/pchain-explorer";
import { PRIMARY_SUBNET_ID, cb58ToHex } from "@/lib/pchain-node";

/* The names a P-Chain page gives the subnets and chains it mentions: the
   Primary Network and its three chains by their own names, a catalog
   chain by its catalog name, anything else by its ID. */

const CATALOG = l1ChainsData as L1Chain[];
const BY_SUBNET = new Map(CATALOG.flatMap((c) => (c.subnetId ? [[c.subnetId, c.chainName] as const] : [])));
let byChainHex: Map<string, string> | null = null;

/** a subnet's name, when the explorer knows one */
export function subnetName(id: string | undefined): string | undefined {
  if (!id) return undefined;
  return id === PRIMARY_SUBNET_ID ? "Primary Network" : BY_SUBNET.get(id);
}

/** a blockchain's name, when the explorer knows one; the catalog keys
 *  chains in hex or CB58, so both are compared in hex */
export function blockchainName(id: string | undefined): string | undefined {
  if (!id) return undefined;
  const known = knownChainName(id);
  if (known) return known;
  byChainHex ??= new Map(
    CATALOG.flatMap((c) => {
      const hex = c.blockchainId?.startsWith("0x") ? c.blockchainId.toLowerCase() : c.blockchainId ? cb58ToHex(c.blockchainId)?.toLowerCase() : null;
      return hex ? [[hex, c.chainName] as const] : [];
    }),
  );
  const hex = id.startsWith("0x") ? id.toLowerCase() : cb58ToHex(id)?.toLowerCase();
  return hex ? byChainHex.get(hex) : undefined;
}
