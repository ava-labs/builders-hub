import { utils } from '@avalabs/avalanchejs';

/**
 * Normalize a user-pasted P-Chain address for the (Fuji-only) faucet.
 *
 * The old logic was `addr.startsWith('P-') ? addr : ` + "`P-fuji1${addr}`" + `,
 * which doubled the HRP when a user pasted a bare `fuji1…` (e.g. from CLI
 * output) — producing `P-fuji1fuji1…` and the cryptic server-side
 * "Invalid checksum" / "Wrong string length" bech32 errors.
 *
 * This re-adds the `P-` chain alias canonically (so `fuji1…`, `P-fuji1…` and
 * bare suffixes all collapse to one `P-fuji1…` form) and validates with the
 * exact same decoder the faucet route uses (`utils.bech32ToBytes`), so the user
 * gets a clear message before submitting instead of a raw bech32 error.
 */
export function normalizePChainFaucetAddress(input: string): { address: string } | { error: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { error: 'Please enter a P-Chain address.' };
  }

  // Strip any existing chain alias, then re-add `P-` canonically. Bare suffixes
  // default to the Fuji HRP (this faucet only serves testnet).
  const body = trimmed.startsWith('P-') ? trimmed.slice(2) : trimmed;
  const withHrp = /^(fuji|avax)1/.test(body) ? body : `fuji1${body}`;
  const address = `P-${withHrp}`;

  try {
    utils.bech32ToBytes(address);
  } catch {
    return {
      error: 'That doesn’t look like a valid P-Chain address. It should look like P-fuji1… — paste the full address.',
    };
  }

  return { address };
}
