// Add validator, change weight and remove validator can open on an L1 from the ?subnetId= query.
// Their stores persist the selected L1 (one store per network), so the query and the stored L1 can differ.
// These rules decide when the query sets the L1.

export interface SubnetIdQueryResult {
  /** The L1 to set in the flow store. Null: do not change the store. */
  subnetId: string | null;
  /** Add this key to the done set, so that the query does not apply again. Null: add nothing. */
  doneKey: string | null;
}

/**
 * Decides what the ?subnetId= query does on one run of the page effect.
 * - The query applies once per page mount, network and query value. After that, the user's own pick stands.
 * - A query that is equal to the stored L1 changes nothing, so the flow keeps its progress.
 * - The query waits until a wallet has reported its chain (`networkKnown`). Until then, the wallet store's
 *   `isTestnet` is the mainnet default, and the query would write a Fuji L1 to the mainnet store. With no
 *   wallet, the query also waits: these flows sign with the wallet, so the user connects one first.
 */
export function resolveSubnetIdQuery({
  query,
  stored,
  isTestnet,
  networkKnown,
  done,
}: {
  query: string | null;
  stored: string;
  isTestnet: boolean;
  networkKnown: boolean;
  done: ReadonlySet<string>;
}): SubnetIdQueryResult {
  const subnetId = query?.trim() ?? '';
  if (!subnetId || !networkKnown) return { subnetId: null, doneKey: null };
  const doneKey = `${isTestnet ? 'testnet' : 'mainnet'}:${subnetId}`;
  if (done.has(doneKey)) return { subnetId: null, doneKey: null };
  return { subnetId: subnetId === stored ? null : subnetId, doneKey };
}
