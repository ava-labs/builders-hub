/**
 * Maps common P-Chain operation errors to human-readable messages.
 * Used by components that submit transactions directly to the P-Chain
 * (registerL1Validator, setL1ValidatorWeight, disableL1Validator, etc.).
 */
export function parsePChainError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  if (raw.includes('User rejected')) return 'Transaction was rejected by user';
  if (raw.includes('insufficient funds')) return 'Insufficient P-Chain balance for transaction';

  // P-Chain rejects with: "signature weight is insufficient: 67*<total> > 100*<signed>".
  // The aggregator returned a partial signature that doesn't meet 67% quorum
  // of the signing subnet. Almost always a transient aggregator/validator
  // availability gap on smaller networks (especially Fuji's Primary Network
  // with its ~9 validators) — a fresh aggregation attempt usually clears it.
  if (raw.includes('signature weight is insufficient')) {
    const match = raw.match(/67\*(\d+) > 100\*(\d+)/);
    if (match) {
      const total = BigInt(match[1]);
      const signed = BigInt(match[2]);
      const percent = total > 0n ? Number((signed * 10000n) / total) / 100 : 0;
      return (
        `Signature aggregator only collected ${percent.toFixed(1)}% of the signing subnet's ` +
        `stake (need 67%). This is a transient aggregator/validator availability gap — retry the ` +
        `P-Chain submission, the next aggregation usually pulls a different set of responders. ` +
        `Common on Fuji, where the Primary Network signing set is small.`
      );
    }
    return (
      'Aggregator returned a partial signature below the 67% quorum P-Chain requires. ' +
      'Retry the P-Chain submission — usually a transient availability gap.'
    );
  }

  // Validator not in a state P-Chain considers valid for this op
  // (e.g. already removed, never registered, wrong sourceChainID for the L1).
  if (raw.includes('failed to fetch sov') || raw.includes('failed to get validator')) {
    return (
      "P-Chain has no record of this validator (or it's already removed). Verify the " +
      'validation ID and check the validator set query before retrying.'
    );
  }

  if (raw.includes('nonce')) return 'Transaction nonce error. Please try again.';
  if (raw.includes('execution reverted')) return `Transaction reverted: ${raw}`;

  return raw;
}
