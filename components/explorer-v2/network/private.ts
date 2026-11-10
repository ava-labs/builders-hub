/* Private L1s: permissioned networks whose RPC, blocks and node versions
   are not public, so the explorer holds only what the P-Chain records of
   them (their validators, and any ICM they send). The catalog marks one
   (constants/l1-chains.json `isPrivate`) only from the chain's or its
   operator's own word: a public chain can also lack a listed RPC. */

import l1ChainsData from "@/constants/l1-chains.json";
import type { L1Chain } from "@/types/stats";

export function isPrivateChain(c: Pick<L1Chain, "isPrivate"> | null | undefined): boolean {
  return c?.isPrivate === true;
}

/** the city's building ids of the private L1s: a building's id is its chain's catalog chainId */
export const PRIVATE_IDS: ReadonlySet<string> = new Set((l1ChainsData as L1Chain[]).filter(isPrivateChain).map((c) => String(c.chainId)));

/** what a private L1's page says in place of the data it cannot show */
export const PRIVATE_NOTE = "Private L1: its RPC, blocks and node versions are not public. The explorer shows what the P-Chain records of it: its validators.";
