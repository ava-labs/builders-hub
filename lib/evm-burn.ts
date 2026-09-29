/* What a block burns on the C-Chain. Every fee burns there, the priority
   tip included, so the burn is the sum of each receipt's gasUsed times its
   effectiveGasPrice. Header math (gasUsed x baseFeePerGas) leaves out the
   tips and, since Helicon, counts reserved gas, so it is not the burn.
   Shared by the burn route and the block page so both show one number. */

export interface FeeReceipt {
  gasUsed: string;
  effectiveGasPrice: string;
}

/** one tx's fee in wei */
export function feeWeiOf(r: FeeReceipt): bigint {
  return BigInt(r.gasUsed) * BigInt(r.effectiveGasPrice);
}

/** a block's fees in wei: the sum over its receipts */
export function sumFeesWei(receipts: FeeReceipt[]): bigint {
  return receipts.reduce((acc, r) => acc + feeWeiOf(r), 0n);
}

/** the chains whose fees all burn, which the burn route serves */
export const BURN_CHAINS = new Set(["43114", "43113"]);
