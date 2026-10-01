import { chainOfId, type CrossChain } from "@/lib/crosschain-links";
import type { Utxo } from "@/lib/pchain-explorer";

/* A P-Chain transaction as the UTXO ledger reads it: what it consumed,
   what it produced and why, and what the chain burned as the fee. The
   amounts stay exact (nAVAX as bigints), so a ledger adds up to the last
   nAVAX: consumed = produced + burned. */

/** what a produced UTXO is for */
export type Purpose = "stake" | "change" | "sent" | "export" | "import" | "reward" | "refund";

export interface LedgerRow {
  key: string;
  purpose: Purpose | "in";
  amount: bigint;
  /** how many UTXOs the row sums */
  count: number;
  addresses: string[];
  threshold: number;
  /** a time lock on the outputs, unix seconds, when it is still ahead */
  lockedUntil: number | null;
  /** the chain the funds came from or went to, when not this one */
  chain?: CrossChain;
  staked: boolean;
}

export interface Ledger {
  consumed: LedgerRow[];
  produced: LedgerRow[];
  totalIn: bigint;
  totalOut: bigint;
  /** inputs less the outputs they funded: the fee and any L1 balance */
  burned: bigint;
}

/** nAVAX, exact: "434.497971476 AVAX", trailing zeros dropped */
export function avaxExact(nAvax: string | number | bigint, symbol = true): string {
  let v: bigint;
  try {
    v = BigInt(typeof nAvax === "number" ? Math.round(nAvax) : nAvax);
  } catch {
    return "—";
  }
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const frac = (abs % 1_000_000_000n).toString().padStart(9, "0").replace(/0+$/, "");
  const whole = (abs / 1_000_000_000n).toLocaleString("en-US");
  return `${neg ? "−" : ""}${whole}${frac ? `.${frac}` : ""}${symbol ? " AVAX" : ""}`;
}

/** an amount in its own asset: AVAX through avaxExact, any other asset in its denomination */
export function assetAmount(u: Pick<Utxo, "amount" | "asset">, exact = false): string {
  const a = u.asset;
  if (!a || a.symbol === "AVAX" || !a.symbol) {
    if (exact) return avaxExact(u.amount);
    const v = Number(u.amount) / 1e9;
    return Number.isFinite(v) ? `${v.toLocaleString("en-US", { maximumFractionDigits: v >= 1 ? 4 : 9 })} AVAX` : "—";
  }
  const v = Number(u.amount) / 10 ** (a.denomination ?? 0);
  return `${v.toLocaleString("en-US", { maximumFractionDigits: Math.min(9, a.denomination ?? 0) })} ${a.symbol}`;
}

export function sumBig(xs: { amount: string }[]): bigint {
  return xs.reduce((t, x) => t + BigInt(x.amount || "0"), 0n);
}

/** the chain an explorer base names: "/explorer/mainnet/p-chain" is the P-Chain */
export function homeChain(base: string): CrossChain {
  const slug = base.split("/")[3];
  return slug === "x-chain" ? "X-Chain" : slug === "c-chain" ? "C-Chain" : "P-Chain";
}

/** the other chain a UTXO came from (side "in") or goes to (side "out"), if any */
export function crossOf(u: Utxo, side: "in" | "out", home: CrossChain): CrossChain | undefined {
  const c = chainOfId(side === "in" ? u.createdOnChainId : u.consumedOnChainId);
  return c && c !== home ? c : undefined;
}

const ownerKey = (u: Pick<Utxo, "addresses" | "threshold">) => `${[...u.addresses].sort().join(",")}/${u.threshold}`;

/** the time lock still ahead of a UTXO, unix seconds */
export function lockAhead(u: Pick<Utxo, "platformLocktime">, now = Date.now() / 1000): number | null {
  return u.platformLocktime > now ? u.platformLocktime : null;
}

/**
 * The ledger of a tx: consumed UTXOs grouped by owner and origin, produced
 * UTXOs grouped by purpose and owner. The tx type says what the outputs
 * the inputs did not fund are: a reward is minted, and a removed L1
 * seat's balance is refunded to its owner. avalanchego adds that refund
 * after the tx's own outputs, at the output index equal to their count.
 */
export function ledgerOf({
  consumed,
  emitted,
  txType,
  outputCount,
  home = "P-Chain",
}: {
  consumed: Utxo[];
  emitted: Utxo[];
  txType: string;
  /** the tx's own outputs, as the node decodes the tx */
  outputCount?: number;
  home?: CrossChain;
}): Ledger {
  const owners = new Set(consumed.flatMap((u) => u.addresses));
  const reward = txType.startsWith("Reward");
  // until the node counts the tx's outputs, a refund shows as the last
  // output when the outputs sum to more than the inputs could fund
  const refundAt =
    txType === "DisableL1ValidatorTx" || txType === "SetL1ValidatorWeightTx"
      ? (outputCount ?? (sumBig(emitted) > sumBig(consumed) ? Math.max(...emitted.map((u) => u.outputIndex)) : -1))
      : -1;
  const purposeOf = (u: Utxo): Purpose => {
    if (reward) return "reward";
    if (u.outputIndex === refundAt) return "refund";
    if (u.staked) return "stake";
    if (crossOf(u, "out", home)) return "export";
    if (txType === "ImportTx") return "import";
    if (u.addresses.length && u.addresses.every((a) => owners.has(a))) return "change";
    return "sent";
  };
  const group = (utxos: Utxo[], side: "in" | "out") => {
    const rows = new Map<string, LedgerRow>();
    for (const u of utxos) {
      const purpose = side === "in" ? "in" : purposeOf(u);
      const chain = crossOf(u, side, home);
      const lock = lockAhead(u);
      const key = `${purpose}|${ownerKey(u)}|${chain ?? ""}|${lock ?? ""}|${side === "in" ? "" : u.staked}`;
      const row = rows.get(key);
      if (row) {
        row.amount += BigInt(u.amount || "0");
        row.count += 1;
      } else {
        rows.set(key, {
          key,
          purpose,
          amount: BigInt(u.amount || "0"),
          count: 1,
          addresses: u.addresses,
          threshold: u.threshold,
          lockedUntil: lock,
          chain,
          staked: u.staked,
        });
      }
    }
    return [...rows.values()].sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0));
  };
  const produced = group(emitted, "out");
  const totalIn = sumBig(consumed);
  const totalOut = sumBig(emitted);
  // outputs the inputs did not pay for: a minted reward, a refunded balance
  const unfunded = produced.filter((r) => r.purpose === "reward" || r.purpose === "refund").reduce((t, r) => t + r.amount, 0n);
  const funded = totalOut - unfunded;
  return { consumed: group(consumed, "in"), produced, totalIn, totalOut, burned: totalIn > funded ? totalIn - funded : 0n };
}
