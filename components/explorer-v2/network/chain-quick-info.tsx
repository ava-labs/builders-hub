"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { base58 } from "@scure/base";
import { sha256 } from "@noble/hashes/sha2";
import { cn } from "@/lib/utils";
import { truncate } from "@/components/explorer-v2/format";
import { fmtCompact } from "@/components/explorer-v2/evm/metric-charts";
import { balanceAt, useSecondClock } from "@/components/explorer-v2/pchain/seat-balance";
import { getCurrentValidators, getL1Validator, getValidatorFeeState, type CurrentValidator } from "@/lib/pchain-node";
import type { L1Chain } from "@/types/stats";

/* A chain's quick info in the city's panel: its blockchain ID as the
   P-Chain spells it, and its validator set, heaviest first, each L1 seat
   with its balance drawn down to now. A set is read once a session: the
   P-Chain's list, and for an L1 one seat and the fee state. The public
   RPC can serve the list from a cache minutes old, while a seat read and
   the fee state answer from the last block. Every active seat burns the
   same fee, so what one seat burned since the list is what each seat
   burned, and the fee state's chain time anchors the rest. */

const SHOWN = 8;

/** the catalog's blockchain ID in CB58, the P-Chain's spelling; the catalog keeps most in hex, and a chain ID that is not a number is the blockchain ID itself */
export function blockchainIdOf(c: L1Chain): string | null {
  const id = c.blockchainId || (/^\d+$/.test(String(c.chainId)) ? null : String(c.chainId));
  if (!id?.startsWith("0x")) return id || null;
  const hex = id.slice(2);
  if (!/^(?:[0-9a-fA-F]{2})+$/.test(hex)) return null;
  // CB58: the bytes, then the last four bytes of their SHA-256
  const bytes = Uint8Array.from(hex.match(/../g)!, (b) => parseInt(b, 16));
  const out = new Uint8Array(bytes.length + 4);
  out.set(bytes);
  out.set(sha256(bytes).slice(-4), bytes.length);
  return base58.encode(out);
}

interface Seats {
  validators: CurrentValidator[];
  /** what draws an L1 seat's balance down to now: the fee price, nAVAX a second; the chain time of the P-Chain's last block, unix seconds;
   *  and the nAVAX each active seat burned between the list and that block. null for a legacy subnet, a set with no active seat, or a read that failed */
  fee: { price: number; settledAt: number; burned: number } | null;
}

const byWeight = (a: CurrentValidator, b: CurrentValidator) => Number(b.weight) - Number(a.weight) || a.nodeID.localeCompare(b.nodeID);

// a set's read, kept for the session: an open waits on the read in flight, and a later open takes its answer
const reads = new Map<string, Promise<Seats | null>>();
const answers = new Map<string, Seats>();

function readSeats(network: string, subnetId: string): Promise<Seats | null> {
  const key = `${network}:${subnetId}`;
  const known = reads.get(key);
  if (known) return known;
  const read = (async (): Promise<Seats | null> => {
    const validators = await getCurrentValidators(network, subnetId);
    if (!validators) return null;
    // the seat with the most balance is the last to run dry, so it keeps burning through any gap
    const anchor = validators.filter((v) => Number(v.balance) > 0 && v.validationID).sort((a, b) => Number(b.balance) - Number(a.balance))[0];
    if (!anchor?.validationID) return { validators, fee: null };
    const [seat, state] = await Promise.all([getL1Validator(network, anchor.validationID), getValidatorFeeState(network)]);
    const settledAt = state ? Date.parse(state.timestamp) / 1000 : NaN;
    if (!state || !Number.isFinite(settledAt)) return { validators, fee: null };
    // a seat topped up since the list reads as no burn
    const burned = seat?.balance !== undefined ? Math.max(0, Number(anchor.balance) - Number(seat.balance)) : 0;
    return { validators, fee: { price: state.price, settledAt, burned } };
  })();
  reads.set(key, read);
  void read.then((s) => {
    if (s) answers.set(key, s);
    // a read that failed is asked again at the next open
    else reads.delete(key);
  });
  return read;
}

const weightOf = (w: string) => {
  const n = Number(w);
  return n >= 1e6 ? fmtCompact(n) : n.toLocaleString("en-US");
};
// six places, so the column lines up and a seat at the fee floor, 512 nAVAX a second, steps every two seconds
const avaxOf = (nAvax: number) =>
  nAvax > 0 && nAvax < 1000 ? "<0.000001 AVAX" : `${(nAvax / 1e9).toLocaleString("en-US", { minimumFractionDigits: 6, maximumFractionDigits: 6 })} AVAX`;

/** the set's heaviest validators, and the door to all of them */
export function ValidatorList({
  network,
  subnetId,
  expected,
  allHref,
}: {
  network: "mainnet" | "fuji";
  subnetId: string;
  /** how many the city counts, for the loading rows */
  expected: number;
  /** the chain's validator table; null when no page holds one */
  allHref: string | null;
}) {
  // undefined while the read is out, null when it failed
  const [seats, setSeats] = useState<Seats | null | undefined>(() => answers.get(`${network}:${subnetId}`));
  useEffect(() => {
    if (seats) return;
    let live = true;
    void readSeats(network, subnetId).then((s) => live && setSeats(s));
    return () => {
      live = false;
    };
    // the panel mounts one list per set
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network, subnetId]);
  const now = useSecondClock(!!seats?.fee);

  const quiet = "mt-4 font-mono text-[10.5px] text-zinc-400 dark:text-zinc-500";
  if (seats === null) return <p className={quiet}>Validators did not load</p>;
  if (seats?.validators.length === 0) return <p className={quiet}>No validators</p>;

  const all = seats?.validators ?? [];
  // an L1's seats carry a balance; a legacy subnet's validators carry none
  const l1 = all.some((v) => v.balance !== undefined);
  const top = [...all].sort(byWeight).slice(0, SHOWN);
  const label = "font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500";
  return (
    <div
      className={cn(
        "mt-4 grid gap-x-4 divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-900 dark:border-zinc-800",
        l1 ? "grid-cols-[minmax(0,1fr)_auto_auto]" : "grid-cols-[minmax(0,1fr)_auto]",
      )}
    >
      <div className="col-span-full grid grid-cols-subgrid px-3 py-2">
        <span className={label}>Validators</span>
        <span className={cn(label, "text-right")}>Weight</span>
        {l1 && <span className={cn(label, "text-right")}>Balance</span>}
      </div>
      {!seats &&
        Array.from({ length: expected > 0 ? Math.min(SHOWN, expected) : 3 }, (_, i) => (
          <div key={i} className="col-span-full flex items-center justify-between gap-4 px-3 py-[9px]">
            <span className="h-2.5 w-32 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
            <span className="h-2.5 w-20 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
          </div>
        ))}
      {top.map((v) => {
        const fee = seats?.fee;
        const balance = v.balance === undefined ? undefined : fee ? balanceAt({ balance: Math.max(0, Number(v.balance) - fee.burned), price: fee.price, settledAt: fee.settledAt }, now) : Number(v.balance);
        return (
          <Link
            key={v.nodeID}
            href={`/explorer/${network}/p-chain/node/${v.nodeID}?subnet=${subnetId}`}
            title={v.nodeID}
            className="group col-span-full grid grid-cols-subgrid items-center px-3 py-[7px] font-mono text-[11.5px] tabular-nums transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            <span className="truncate text-[#0061E2] group-hover:underline dark:text-[#5f9dff]">{truncate(v.nodeID, 13)}</span>
            <span className="text-right text-zinc-700 dark:text-zinc-300">{weightOf(v.weight)}</span>
            {l1 && (
              <span className={cn("text-right", balance === 0 ? "text-[#E6212F]" : "text-zinc-700 dark:text-zinc-300")}>
                {balance === undefined ? "—" : balance === 0 ? "Inactive" : avaxOf(balance)}
              </span>
            )}
          </Link>
        );
      })}
      {seats && allHref && (
        <Link
          href={allHref}
          className="col-span-full flex items-center gap-1 px-3 py-2 font-mono text-[11.5px] text-[#0061E2] transition-colors hover:bg-zinc-50 dark:text-[#5f9dff] dark:hover:bg-zinc-900"
        >
          All {all.length.toLocaleString("en-US")} validators
          <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
