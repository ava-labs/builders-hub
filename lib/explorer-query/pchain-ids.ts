/* P-Chain identifiers, both ways. ClickHouse stores tx, block and node ids
   and addresses as raw bytes; the explorer shows CB58 (tx and block ids,
   NodeID-…) and bech32 (P-avax1…). Queries return CB58 themselves; this
   turns addresses into bech32 for the page, and any of them back into
   bytes for a drill. */

import { base58, bech32 } from "@scure/base";
import { sha256 } from "@noble/hashes/sha2";

type Row = Record<string, unknown>;

/** the raw bytes behind an identifier as the page shows it: 0x hex, a CB58
    id (tx, block, subnet), NodeID-…, or a bech32 address (P-avax1…) */
export function toHexBytes(v: string): string | null {
  const s = v.trim();
  if (/^0x[0-9a-fA-F]*$/.test(s)) return s.slice(2).toLowerCase();
  try {
    const addr = s.replace(/^[PXC]-/, "");
    if (/^(avax|fuji|local)1[02-9ac-hj-np-z]+$/.test(addr)) {
      const { words } = bech32.decode(addr as `${string}1${string}`);
      return hexOf(bech32.fromWords(words));
    }
    const body = s.replace(/^NodeID-/, "");
    if (/^[1-9A-HJ-NP-Za-km-z]+$/.test(body)) {
      const raw = base58.decode(body);
      if (raw.length < 5) return null;
      const payload = raw.slice(0, -4);
      const check = sha256(payload).slice(-4);
      if (check.every((b, i) => b === raw[raw.length - 4 + i])) return hexOf(payload);
    }
  } catch {
    /* not an identifier */
  }
  return null;
}

const hexOf = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

/** P-Chain rows as the explorer names things: addresses as P-avax1… (the
    query returns them as hex, since ClickHouse has no Avalanche bech32) */
export function pchainRows(rows: Row[], columns: { name: string }[], hrp: string): void {
  const cols = columns.map((c) => c.name).filter((n) => /address|owner|addr/i.test(n));
  if (!cols.length) return;
  const one = (v: unknown) => {
    if (typeof v !== "string") return v;
    const h = v.replace(/^0x/i, "");
    if (!/^[0-9a-fA-F]{40}$/.test(h)) return v;
    return `P-${bech32.encode(hrp, bech32.toWords(Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16)))))}`;
  };
  for (const r of rows) for (const c of cols) r[c] = Array.isArray(r[c]) ? (r[c] as unknown[]).map(one) : one(r[c]);
}
