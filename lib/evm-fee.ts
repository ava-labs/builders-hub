/* What an EVM transaction pays per gas, and how that price splits into the
   base fee and the priority fee (the tip), by the EIP-1559 rules. Amounts
   are wei, as bigint.

   On the C-Chain since Helicon (ACP-194) a header's baseFeePerGas is the
   worst-case bound that acceptance checks. Execution charges the price of
   its own moment, which can be lower but never under the minimum that the
   validators set (ACP-283, the header's minPriceExponent). The receipt's
   effectiveGasPrice is the price paid; the base fee inside it is read back
   from the bid. */

export interface FeeBid {
  /** legacy and access-list txs: one price for both parts */
  gasPrice?: bigint;
  /** dynamic-fee txs (type 2 and later): the caps */
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
}

/** a tx's fee fields as its RPC copy carries them */
export interface TxFeeFacts {
  bid: FeeBid;
  /** the receipt's effectiveGasPrice: the price per gas paid */
  paid: bigint;
  /** its block's header baseFeePerGas; since Helicon the worst-case bound */
  bound: bigint | null;
  /** the validators' minimum (ACP-283) when the header carries it: C-Chain blocks since Helicon */
  floor: bigint | null;
}

const min = (a: bigint, b: bigint): bigint => (a < b ? a : b);

function isDynamic(bid: FeeBid): bid is FeeBid & { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } {
  return bid.maxFeePerGas !== undefined && bid.maxPriorityFeePerGas !== undefined;
}

/** the tip per gas a bid pays at this base fee; null when the bid is under it */
export function tipAt(bid: FeeBid, baseFee: bigint): bigint | null {
  if (isDynamic(bid)) return bid.maxFeePerGas < baseFee ? null : min(bid.maxPriorityFeePerGas, bid.maxFeePerGas - baseFee);
  if (bid.gasPrice === undefined || bid.gasPrice < baseFee) return null;
  return bid.gasPrice - baseFee;
}

export interface PaidSplit {
  /** the base fee per gas inside the paid price */
  base: bigint;
  /** the tip per gas inside the paid price */
  tip: bigint;
  /** false when the bid leaves the split open: base is then the bound, the largest it can be, and tip the smallest */
  exact: boolean;
}

/** the base fee and the tip inside a receipt's effective gas price. A
 *  dynamic-fee tx that paid less than its max fee paid its whole max
 *  priority fee, so the split is exact. A legacy tx, or one that paid its
 *  max fee, fixes only the sum: its base fee lies between `floor` and
 *  `bound`, and the split is exact when the two meet. Give floor = bound
 *  where the header base fee is the price charged (before Helicon, other
 *  chains). */
export function splitPaid(bid: FeeBid, paid: bigint, range: { bound: bigint; floor?: bigint }): PaidSplit {
  if (isDynamic(bid) && paid < bid.maxFeePerGas) {
    const tip = min(bid.maxPriorityFeePerGas, paid);
    return { base: paid - tip, tip, exact: true };
  }
  const base = min(range.bound, paid);
  return { base, tip: tipAt(bid, base) ?? 0n, exact: range.floor !== undefined && range.floor >= range.bound };
}

/** a block's executed base fee, read back from its receipts: one base fee
 *  applies to every tx in a block, and a dynamic-fee tx that paid less than
 *  its max fee paid it plus its whole max priority fee. Null when no tx in
 *  the list fixes it (only legacy txs, or only txs that paid their max). */
export function executedBaseFee(txs: { bid: FeeBid; paid: bigint }[]): bigint | null {
  for (const { bid, paid } of txs) {
    if (isDynamic(bid) && paid < bid.maxFeePerGas && paid >= bid.maxPriorityFeePerGas) return paid - bid.maxPriorityFeePerGas;
  }
  return null;
}

const MAX_U64 = (1n << 64n) - 1n;

/** min x e^(excess / k), by the integer series of avalanchego's
 *  gas.CalculatePrice (vms/components/gas/gas.go), so a header's exponent
 *  decodes to the node's value exactly. The C-Chain encodes its minimum
 *  price (ACP-283), gas target (ACP-176) and minimum block delay (ACP-226)
 *  this way. */
export function calculatePrice(minimum: bigint, excess: bigint, k: bigint): bigint {
  let i = 1n;
  let output = 0n;
  let acc = minimum * k;
  const ceiling = k * MAX_U64;
  while (acc > 0n) {
    output += acc;
    if (output >= ceiling) return MAX_U64;
    acc = (acc * excess) / k / i;
    i += 1n;
  }
  return output / k;
}

/** the validators' minimum gas price in wei (ACP-283), from a header's minPriceExponent */
export function priceFloor(minPriceExponent: bigint): bigint {
  return calculatePrice(1n, minPriceExponent, 415_828_534_307_635_077n);
}
