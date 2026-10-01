"use client";

import Link from "next/link";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Board, TxTypePill, feeInk, idInk } from "@/components/explorer-v2/ui";
import { formatAvax, formatTime, formatUsd, truncate } from "@/components/explorer-v2/format";
import { PRIMARY_SUBNET_ID, VM_NAMES, type DecodedL1WarpMessage } from "@/lib/pchain-node";
import { txTypeLabel, type Tx } from "@/lib/pchain-explorer";
import { avaxExact, sumBig, type Ledger, type LedgerRow } from "./utxo";
import { blockchainName, subnetName } from "./names";
import { autoCompoundPct, humanPeriod, type TxContext } from "./tx-hooks";

/* The glance layer of a P-Chain tx, in the C-Chain story's voice: one
   sentence saying what happened, in the words a person would use, then
   the UTXO ledger, consumed to produced, with what the inputs paid beyond
   their outputs. The ledger is exact to the nAVAX, so its rows add up;
   the flow and the table below show the same UTXOs one by one. */

const INK = "text-zinc-900 dark:text-zinc-50";
const LINK = cn("font-medium hover:text-[#E6212F]", INK);

const PURPOSE: Record<LedgerRow["purpose"], { type: string; label: string }> = {
  in: { type: "neutral", label: "in" },
  stake: { type: "stake", label: "stake" },
  change: { type: "neutral", label: "change" },
  sent: { type: "neutral", label: "sent" },
  export: { type: "export", label: "export" },
  import: { type: "import", label: "import" },
  reward: { type: "reward", label: "reward" },
  refund: { type: "subnet", label: "refund" },
};

const day = (ts: number) => formatTime(ts).slice(0, 10);

export function PchainTxStory({
  tx,
  ctx,
  ledger,
  decoded,
  base,
  avaxUsd,
  uptimeReq,
  balance,
}: {
  tx: Tx;
  ctx: TxContext;
  ledger: Ledger;
  decoded: DecodedL1WarpMessage | null;
  base: string;
  avaxUsd: number | null;
  uptimeReq: number;
  /** nAVAX the tx moved into L1 validators' balances; null while the node's copy loads */
  balance: number | null;
}) {
  const d = tx.details;
  const addr = (a: string) => (
    <Link href={`${base}/address/${a.replace(/^P-/, "")}`} className={LINK} title={a}>
      {truncate(a, 12)}
    </Link>
  );
  const node = (id: string, subnet?: string) => (
    <Link href={`${base}/node/${id}${subnet && subnet !== PRIMARY_SUBNET_ID ? `?subnet=${subnet}` : ""}`} className={LINK} title={id}>
      {truncate(id, 13)}
    </Link>
  );
  // a named subnet reads by its name, "the Beam subnet" where the sentence is about the subnet itself
  const subnet = (id: string, noun = false) =>
    id === PRIMARY_SUBNET_ID ? (
      <span className={cn("font-medium", INK)}>the Primary Network</span>
    ) : (
      <Link href={`${base}/tx/${id}`} className={LINK} title={id}>
        {subnetName(id) ? (noun ? `the ${subnetName(id)} subnet` : subnetName(id)) : `subnet ${truncate(id, 8)}`}
      </Link>
    );
  const chain = (id: string | undefined) => <span className={cn("font-medium", INK)}>{id ? (blockchainName(id) ?? truncate(id, 8)) : "another chain"}</span>;
  const txl = (hash: string | undefined, noun = "") =>
    hash ? (
      <Link href={`${base}/tx/${hash}`} className={LINK} title={hash}>
        {noun}
        {truncate(hash, 8)}
      </Link>
    ) : (
      <>a stake</>
    );
  const amt = (nAvax: number | bigint) => (
    <span className={cn("font-medium tabular-nums", INK)}>
      {formatAvax(Number(nAvax))}
      {formatUsd(Number(nAvax), avaxUsd) && <span className="font-normal text-zinc-400 dark:text-zinc-500"> ({formatUsd(Number(nAvax), avaxUsd)})</span>}
    </span>
  );
  const many = (addrs: string[], noun = "addresses") => (addrs.length === 1 ? addr(addrs[0]) : <>{addrs.length} {noun}</>);
  const ownersOf = (rows: LedgerRow[]) => [...new Set(rows.flatMap((r) => r.addresses))];

  const payer = ledger.consumed.find((r) => r.addresses.length)?.addresses[0];
  const who = payer ? addr(payer) : ownersOf(ledger.produced)[0] ? addr(ownersOf(ledger.produced)[0]) : <>A wallet</>;
  const staked = sumBig(tx.amountStaked);
  const period = tx.period !== undefined ? (tx.periodHuman ?? humanPeriod(tx.period)) : null;
  const pct = autoCompoundPct(tx);
  const outsOf = (p: LedgerRow["purpose"]) => ledger.produced.filter((r) => r.purpose === p);
  const total = (rows: LedgerRow[]) => rows.reduce((t, r) => t + r.amount, 0n);
  const seatName = ctx.l1Seat?.nodeID ? node(ctx.l1Seat.nodeID, ctx.l1Seat.subnetID) : d?.validationId ? <span className={cn("font-medium", INK)} title={d.validationId}>the validator {truncate(d.validationId, 8)}</span> : <>an L1 validator</>;

  const kept = BigInt(Math.round(balance ?? 0));
  const fee = ledger.burned > kept ? ledger.burned - kept : 0n;

  const sentence = (() => {
    switch (tx.txType) {
      case "AddPermissionlessValidatorTx":
      case "AddValidatorTx":
        return (
          <>
            {tx.nodeId ? node(tx.nodeId, tx.subnetId) : who} staked {amt(staked)} to validate {tx.subnetId ? subnet(tx.subnetId) : "the Primary Network"}
            {tx.endTimestamp ? <> until {day(tx.endTimestamp)}</> : null}
            {d?.delegationFeePercent !== undefined && <>, at a {d.delegationFeePercent}% delegation fee</>}
          </>
        );
      case "AddPermissionlessDelegatorTx":
      case "AddDelegatorTx":
        return (
          <>
            {who} delegated {amt(staked)} to {tx.nodeId ? node(tx.nodeId) : "a validator"}
            {tx.endTimestamp ? <> until {day(tx.endTimestamp)}</> : null}
          </>
        );
      case "AddAutoRenewedValidatorTx":
        return (
          <>
            {tx.nodeId ? node(tx.nodeId) : who} staked {amt(staked)}
            {period && tx.period ? <>, renewing every {period}</> : null}
            {pct !== null && <>, with {pct}% of each reward restaked</>}
          </>
        );
      case "SetAutoRenewedValidatorConfigTx":
        return tx.period === 0 ? (
          <>
            {who} stopped {txl(d?.stakingTxId, "the stake ")} from renewing: it ends after its current period
          </>
        ) : (
          <>
            {who} set {txl(d?.stakingTxId, "the stake ")} to renew{period ? <> every {period}</> : null}
            {pct !== null && <>, restaking {pct}% of each reward</>}
          </>
        );
      case "RewardValidatorTx": {
        if (d?.rewardPaid === false)
          return (
            <>
              {txl(d.stakingTxId, "The stake ")} ended with no reward: its uptime was under {uptimeReq}%
            </>
          );
        const owners = ownersOf(ledger.produced);
        return (
          <>
            {txl(d?.stakingTxId, "The stake ")} ended and paid {amt(ledger.totalOut || BigInt(ctx.rewardWithdrawn))} in rewards
            {owners.length > 0 && <> to {many(owners, "owners")}</>}
          </>
        );
      }
      case "RewardAutoRenewedValidatorTx":
        if (ctx.rewardUtxos?.length === 0) return <>A cycle of {txl(d?.stakingTxId, "the stake ")} ended, its whole reward compounded into the stake</>;
        return ctx.rewardRestaked !== null && ctx.rewardUtxos ? (
          <>
            A cycle of {txl(d?.stakingTxId, "the stake ")} paid {amt(ctx.rewardRestaked + ctx.rewardWithdrawn)}: {amt(ctx.rewardRestaked)} restaked and{" "}
            {amt(ctx.rewardWithdrawn)} paid out
          </>
        ) : (
          <>A cycle of {txl(d?.stakingTxId, "the stake ")} ended and paid its reward</>
        );
      case "ImportTx":
        return (
          <>
            {ownersOf(ledger.produced)[0] ? addr(ownersOf(ledger.produced)[0]) : who} moved {amt(ledger.totalOut)} from the {chain(d?.sourceChain)}
          </>
        );
      case "ExportTx":
        return (
          <>
            {who} moved {amt(total(outsOf("export")))} to the {chain(d?.destinationChain)}
          </>
        );
      case "BaseTx": {
        const sent = outsOf("sent");
        return sent.length ? (
          <>
            {who} sent {amt(total(sent))} to {many(ownersOf(sent))}
          </>
        ) : (
          <>
            {who} moved {amt(ledger.totalOut)} between its own UTXOs
          </>
        );
      }
      case "CreateSubnetTx": {
        const keys = d?.subnetOwners ?? [];
        return (
          <>
            {who} created {txl(tx.txHash, "the subnet ")}
            {keys.length === 1 ? <>, owned by {addr(keys[0])}</> : keys.length > 1 ? <>, owned by {d?.subnetThreshold ?? 1} of {keys.length} keys</> : null}
          </>
        );
      }
      case "CreateChainTx":
        return (
          <>
            {who} created {d?.chainName ? <span className={cn("font-medium", INK)}>{d.chainName}</span> : "a chain"}
            {tx.subnetId && <> on {subnet(tx.subnetId)}</>}
            {d?.vmId && VM_NAMES[d.vmId] && <>, running {VM_NAMES[d.vmId]}</>}
          </>
        );
      case "ConvertSubnetToL1Tx": {
        const n = ctx.platformOp.data?.validators?.length;
        return (
          <>
            {who} converted {tx.subnetId ? subnet(tx.subnetId, true) : "a subnet"} to an L1
            {n ? <> with {n} validator{n === 1 ? "" : "s"}</> : null}
          </>
        );
      }
      case "RegisterL1ValidatorTx":
        return decoded?.kind === "register" ? (
          <>
            {who} registered {node(decoded.nodeId, decoded.subnetId)} as a validator of {subnet(decoded.subnetId)}, with a {amt(kept)} balance
          </>
        ) : (
          <>
            {who} registered an L1 validator with a {amt(kept)} balance
          </>
        );
      case "SetL1ValidatorWeightTx":
        if (decoded?.kind !== "weight") return <>{who} changed the weight of an L1 validator</>;
        return decoded.weight === 0 ? (
          <>
            {who} removed the validator {truncate(decoded.validationId, 8)} from its L1
          </>
        ) : (
          <>
            {who} set the weight of the validator {truncate(decoded.validationId, 8)} to {decoded.weight.toLocaleString("en-US")}
          </>
        );
      case "IncreaseL1ValidatorBalanceTx":
        return (
          <>
            {who} added {amt(kept)} to the balance of {seatName}
          </>
        );
      case "DisableL1ValidatorTx": {
        const refund = outsOf("refund");
        return (
          <>
            {who} disabled {seatName}
            {refund.length > 0 && (
              <>
                , and its remaining {amt(total(refund))} went back to {many(ownersOf(refund), "owners")}
              </>
            )}
          </>
        );
      }
      case "AddSubnetValidatorTx":
        return (
          <>
            {tx.nodeId ? node(tx.nodeId, tx.subnetId) : who} joined {tx.subnetId ? subnet(tx.subnetId) : "a subnet"}
            {d?.weight !== undefined && <> with weight {d.weight.toLocaleString("en-US")}</>}
            {tx.endTimestamp ? <> until {day(tx.endTimestamp)}</> : null}
          </>
        );
      case "RemoveSubnetValidatorTx":
        return (
          <>
            {who} removed {tx.nodeId ? node(tx.nodeId, tx.subnetId) : "a validator"} from {tx.subnetId ? subnet(tx.subnetId) : "its subnet"}
          </>
        );
      case "TransferSubnetOwnershipTx": {
        const keys = d?.subnetOwners ?? [];
        return (
          <>
            {who} gave {tx.subnetId ? subnet(tx.subnetId, true) : "a subnet"} to {many(keys, "owners")}
            {keys.length > 1 && <>, {d?.subnetThreshold ?? 1} of {keys.length} to sign</>}
          </>
        );
      }
      default:
        return (
          <>
            {who} sent {/^[aeiou]/i.test(txTypeLabel(tx.txType)) ? "an" : "a"} {txTypeLabel(tx.txType)} transaction
          </>
        );
    }
  })();

  const end = tx.endTimestamp ?? 0;
  const note = (r: LedgerRow) => {
    const bits: string[] = [];
    if (r.purpose === "in") bits.push(`${r.count} UTXO${r.count === 1 ? "" : "s"}`);
    else if (r.count > 1) bits.push(`${r.count} UTXOs`);
    if (r.purpose === "stake" && end) bits.push(end > Date.now() / 1000 ? `locked to ${day(end)}` : `unlocked ${day(end)}`);
    if (r.purpose === "stake" && !end && period && tx.period) bits.push(`renews every ${period}`);
    if (r.lockedUntil) bits.push(`locked to ${day(r.lockedUntil)}`);
    if (r.addresses.length > 1) bits.push(`${r.threshold} of ${r.addresses.length} to sign`);
    if (r.chain) bits.push(r.purpose === "in" ? `from the ${r.chain}` : `to the ${r.chain}`);
    if (r.purpose === "refund") bits.push("the seat's remaining balance");
    return bits.join(" · ");
  };

  return (
    <Board divide={false}>
      <p className="px-5 py-7 font-mono text-[15px] leading-[1.9] text-zinc-600 md:px-6 md:py-8 md:text-[17px] dark:text-zinc-400">{sentence}</p>

      {/* the ledger: what went in, what came out and why, what the inputs paid beyond it */}
      <div className="border-t border-zinc-200 dark:border-zinc-800">
        <Group label="Consumed" total={ledger.totalIn} />
        {ledger.consumed.length === 0 && (
          <Line chip={{ type: "reward", label: "none" }} who={null} note={tx.txType.startsWith("Reward") ? "a reward is minted, not spent" : "no inputs"} amount={null} />
        )}
        {ledger.consumed.map((r) => (
          <Line key={r.key} chip={PURPOSE.in} who={r.addresses} note={note(r)} amount={r.amount} base={base} />
        ))}
        <Group label="Produced" total={ledger.totalOut} />
        {ledger.produced.length === 0 && <Line chip={{ type: "neutral", label: "none" }} who={null} note="no outputs" amount={null} />}
        {ledger.produced.map((r) => (
          <Line key={r.key} chip={PURPOSE[r.purpose]} who={r.addresses} note={note(r)} amount={r.amount} base={base} />
        ))}
        {balance === null ? (
          <Line chip={{ type: "abort", label: "burned" }} who={null} note="inputs less outputs: the fee and the L1 balances" amount={ledger.burned} fee />
        ) : (
          <>
            {kept > 0n && <Line chip={{ type: "subnet", label: "L1 balance" }} who={null} note="into the validators' prepaid balances" amount={kept} />}
            {(fee > 0n || ledger.consumed.length > 0) && <Line chip={{ type: "abort", label: "fee" }} who={null} note="burned: inputs less outputs" amount={fee} fee />}
          </>
        )}
      </div>

      {/* the door down */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-zinc-200 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:px-6 dark:border-zinc-800 dark:text-zinc-500">
        <span>
          {tx.consumedUtxos.length} consumed · {ctx.flowEmitted.length} produced
        </span>
        <a href="#fund-flow" className="inline-flex items-center gap-1.5 text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
          Each UTXO
          <ArrowDown className="size-3" />
        </a>
      </div>
    </Board>
  );
}

function Group({ label, total }: { label: string; total: bigint }) {
  return (
    <div className="flex items-baseline justify-between gap-4 bg-zinc-50/80 px-5 pb-1.5 pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:px-6 dark:bg-zinc-900/40 dark:text-zinc-500">
      <span className="font-bold text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="tabular-nums normal-case tracking-normal">{avaxExact(total)}</span>
    </div>
  );
}

function Line({
  chip,
  who,
  note,
  amount,
  base,
  fee = false,
}: {
  chip: { type: string; label: string };
  who: string[] | null;
  note: string;
  amount: bigint | null;
  base?: string;
  fee?: boolean;
}) {
  // a phone sets the chip and the amount on one line, the owner and the note under them
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-t border-zinc-200 px-5 py-2.5 font-mono text-[12.5px] md:h-11 md:grid-cols-[6.5rem_minmax(0,1fr)_auto] md:py-0 md:px-6 dark:border-zinc-800">
      <TxTypePill type={chip.type} label={chip.label} />
      <span className="min-w-0 text-zinc-500 max-md:order-last max-md:col-span-2 max-md:text-[12px] md:truncate dark:text-zinc-400">
        {who?.length ? (
          <>
            <Link href={`${base}/address/${who[0]}`} className={cn(idInk, "hover:text-[#E6212F]")} title={who.join(", ")}>
              {truncate(who[0], 12)}
            </Link>
            {who.length > 1 && <span> +{who.length - 1}</span>}
            {note && <span className="text-zinc-400 dark:text-zinc-500"> · {note}</span>}
          </>
        ) : (
          note
        )}
      </span>
      <span className={cn("text-right tabular-nums", fee ? feeInk : INK)}>{amount === null ? "" : avaxExact(amount)}</span>
    </div>
  );
}
