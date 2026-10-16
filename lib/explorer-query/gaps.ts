/* What the mainnet P-Chain tables do not hold, and the stake that fills it.

   The snapshot pollers (p_validator_snapshots, p_delegator_snapshots,
   p_l1_validator_snapshots) and the exec-state follower
   (p_exec_state_history) wrote no rows from 2026-08-13 11:20 to
   2026-08-26 12:03 UTC, while the stats database moved hosts. They read
   forward only, so those days stay empty. Blocks and transactions are
   complete.

   platform.getValidatorsAt gives the Primary Network's validator set at
   any height, each node's weight with its delegations. At 8 snapshots on
   both sides of the gap its sum equals the snapshot's sum(weight +
   delegator_weight) to the nAVAX, so it fills the stake: one row per day
   at the day's last block (raw_p_blocks), read 2026-10-16 from a mainnet
   node with {"height": "<block_height>", "subnetID":
   "11111111111111111111111111111111LpoYY"}. It gives no delegator rows,
   uptimes or rewards, which stay missing. */

import { sqlWindow } from "./scope";
import type { SourceNote } from "./types";
import { andList } from "./values";

interface Gap {
  tables: readonly string[];
  /** the last row before the gap and the first after it, epoch ms */
  from: number;
  to: number;
}

export const PCHAIN_GAPS: readonly Gap[] = [
  { tables: ["p_validator_snapshots", "p_delegator_snapshots", "p_l1_validator_snapshots"], from: Date.UTC(2026, 7, 13, 11, 20, 28, 81), to: Date.UTC(2026, 7, 26, 12, 3, 37, 636) },
  { tables: ["p_exec_state_history"], from: Date.UTC(2026, 7, 13, 11, 22, 44), to: Date.UTC(2026, 7, 26, 12, 3, 45) },
];

/** the Primary Network's stake at the last block of each UTC day the snapshots miss: block time, height, validators
    and the sum of their weights in nAVAX, as getValidatorsAt returns it */
export const STAKE_FILL: readonly { at: string; height: number; validators: number; weight: string }[] = [
  { at: "2026-08-13 23:57:21", height: 25359462, validators: 601, weight: "213408752028754418" },
  { at: "2026-08-14 23:56:15", height: 25364332, validators: 608, weight: "215379138510185248" },
  { at: "2026-08-15 23:58:45", height: 25369329, validators: 606, weight: "215098856500969890" },
  { at: "2026-08-16 23:59:58", height: 25374414, validators: 607, weight: "215453202683907010" },
  { at: "2026-08-17 23:59:13", height: 25379265, validators: 609, weight: "214671344774628511" },
  { at: "2026-08-18 23:56:42", height: 25383730, validators: 609, weight: "216909523163416674" },
  { at: "2026-08-19 23:58:56", height: 25388159, validators: 607, weight: "216283764489541806" },
  { at: "2026-08-20 23:57:02", height: 25392764, validators: 609, weight: "217338038426936345" },
  { at: "2026-08-21 23:55:14", height: 25396445, validators: 613, weight: "218210404493017914" },
  { at: "2026-08-22 23:59:15", height: 25401119, validators: 612, weight: "218426827224822820" },
  { at: "2026-08-23 23:56:02", height: 25405785, validators: 611, weight: "217288397179226896" },
  { at: "2026-08-24 23:59:48", height: 25410105, validators: 610, weight: "217974794810559537" },
  { at: "2026-08-25 23:54:38", height: 25415136, validators: 614, weight: "217312608443796451" },
];

/** what each table holds, for the reader */
const HOLDS: Record<string, string> = {
  p_validator_snapshots: "validator snapshots",
  p_delegator_snapshots: "delegator snapshots",
  p_l1_validator_snapshots: "L1 validator snapshots",
  p_exec_state_history: "P-Chain supply records",
};

const stamp = (t: number) => new Date(t).toISOString().slice(0, 16).replace("T", " ");
const reads = (sql: string, table: string) => new RegExp(`\\b${table}\\b`, "i").test(sql);

/** the writer's line on the gaps and the fill (prompt.ts), mainnet P-Chain */
export function gapsLine(): string {
  const [snaps, exec] = PCHAIN_GAPS;
  return `- Missing days: ${andList(snaps.tables)} have no rows from ${stamp(snaps.from)} to ${stamp(snaps.to)} UTC, and ${exec.tables[0]} none from ${stamp(exec.from)} to ${stamp(exec.to)} UTC (the indexer stopped). p_stake_fill holds the Primary Network's stake on those days, one row per day at its last block (snapshot_time is that block's time), read from the P-Chain's own validator sets and equal to the snapshots where both exist: a series of the Primary Network's stake or validator count adds its rows to the snapshots' with UNION ALL, as in the worked examples. Every other read leaves those days empty. The page states which days are filled and which are missing, so the note never mentions them.`;
}

/** a line on the page for each gap a query's window reaches: the tables it reads that have no rows then. A query
    that adds p_stake_fill to the validator snapshots reads that stake from the fill, whose own note says so. Mainnet
    P-Chain only. A window the SQL does not state as a range (one snapshot's time, a subquery) gets no line: a line
    for days the query does not read is worse than none */
export function gapNotes(sql: string, chainId: number, now = Date.now()): SourceNote[] {
  if (chainId !== 1) return [];
  const w = sqlWindow(sql, now);
  if (!w || w === "unknown") return [];
  const filled = reads(sql, "p_stake_fill");
  return PCHAIN_GAPS.flatMap((g) => {
    const missing = g.tables.filter((t) => reads(sql, t) && !(filled && t === "p_validator_snapshots"));
    if (!missing.length || w.start >= g.to || w.end <= g.from) return [];
    const text = `No ${andList(missing.map((t) => HOLDS[t]))} exist from ${stamp(g.from)} to ${stamp(g.to)} UTC. The indexer stopped while the stats database moved hosts, so those days are empty.`;
    return [{ table: missing[0], label: "", at: now, total: 0, known: 0, text }];
  });
}
