/**
 * Maps common P-Chain operation errors to human-readable messages.
 * Used by components that submit transactions directly to the P-Chain
 * (registerL1Validator, setL1ValidatorWeight, disableL1Validator, etc.).
 */
export function parsePChainError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  if (raw.includes('User rejected')) return 'Transaction was rejected by user';
  if (raw.includes('insufficient funds')) return 'Insufficient P-Chain balance for transaction';
  if (raw.includes('nonce')) return 'Transaction nonce error. Please try again.';
  if (raw.includes('execution reverted')) return `Transaction reverted: ${raw}`;

  return raw;
}
