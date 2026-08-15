import type { L1ListItem } from './l1ListStore';

/**
 * Patch applied to an existing L1 list entry. Identity keys are excluded:
 * `id`/`evmChainId` address the entry and `isTestnet` is the store-level
 * invariant (there is one list per network).
 */
export type L1ListPatch = Partial<Omit<L1ListItem, 'id' | 'evmChainId' | 'isTestnet'>>;

const IDENTITY_KEYS = new Set(['id', 'evmChainId', 'isTestnet']);

/** Immutable single-entry patch; returns the original array when the chain
 *  is absent so store subscribers see no spurious update. */
export function patchL1ByEvmChainId(list: L1ListItem[], evmChainId: number, patch: L1ListPatch): L1ListItem[] {
  if (!list.some((item) => item.evmChainId === evmChainId)) return list;
  const safePatch = Object.fromEntries(Object.entries(patch).filter(([key]) => !IDENTITY_KEYS.has(key))) as L1ListPatch;
  return list.map((item) => (item.evmChainId === evmChainId ? { ...item, ...safePatch } : item));
}
