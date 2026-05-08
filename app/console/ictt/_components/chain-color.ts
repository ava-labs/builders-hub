/**
 * Chain accent color resolver.
 *
 * `L1ListItem` does not carry a color field, so we map well-known chains
 * to brand colors and fall back to a deterministic palette pick for any
 * unknown chain. Symmetric with the colored-initials fallback used by
 * `app/console/my-l1/_components/SwitchChainRail.tsx` for chains without
 * a logo.
 */

const KNOWN_CHAIN_COLORS: Record<string, string> = {
  // Fuji + Mainnet C-Chain (Avalanche red)
  yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp: '#E84142',
  '2q9e4r6Mu3U68nU1fYjgbR6JvwrRx36CohpAX5UQxse55x1Q5': '#E84142',
  // Echo (emerald)
  '98qnjenm7MBd8G2cPZoRvZrgJC33JGSAAKghsQ6eojbLCeRNp': '#10B981',
  // Dispatch (purple)
  '2D8RG4UpSXbPbvPCAWppNJyqTG2i2CAXSkTgmTBBvs7GKNZjsY': '#7C5CFF',
  // Dexalot (amber)
  '2TTSLdR6uEM3R5Ukej3YThHSyPf6XCfppAsh5vAuzFA1rY5w7e': '#F59E0B',
};

const FALLBACK_PALETTE = [
  '#F43F5E', // rose
  '#10B981', // emerald
  '#0EA5E9', // sky
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
];

export function chainColor(chainId: string | undefined | null): string {
  if (!chainId) return '#71717A'; // zinc-500 fallback
  const known = KNOWN_CHAIN_COLORS[chainId];
  if (known) return known;
  // Deterministic hash of chain ID -> palette index. Produces stable
  // colors across reloads and across chains.
  let hash = 0;
  for (let i = 0; i < chainId.length; i++) {
    hash = (hash * 31 + chainId.charCodeAt(i)) & 0x7fffffff;
  }
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}

export function chainInitial(name: string | undefined | null): string {
  if (!name) return '?';
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const words = trimmed.split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return trimmed.slice(0, 1).toUpperCase();
}
