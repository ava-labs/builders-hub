/**
 * Validate and clean a transaction hash string.
 * Returns a properly typed `0x${string}` or null if invalid.
 */
export function validateAndCleanTxHash(hash: string): `0x${string}` | null {
  if (!hash) return null;
  const cleanHash = hash.trim().toLowerCase();
  if (!cleanHash.startsWith('0x')) return null;
  if (cleanHash.length !== 66) return null;
  return cleanHash as `0x${string}`;
}
