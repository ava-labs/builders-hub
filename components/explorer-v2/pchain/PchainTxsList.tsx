"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import { Board, CellLabel, SectionHeader, TxTypePill, TypeFilterRail, idInk } from "@/components/explorer-v2/ui";
import { formatNumber, timeAgo, truncate } from "@/components/explorer-v2/format";
import { usePchainData, LIVE_REFRESH_MS } from "./hooks";
import type { TxSummary } from "@/lib/pchain-explorer";

/* The types the upstream indexer serves, grouped by the same families the
   pills are toned by (see txToneText/pillTone) so the rail and the table
   below read as one vocabulary. Every value here is a type the indexer
   answers `?type=` for; the auto-renewed trio returns nothing until a
   network has Helicon active, which the empty state states plainly. */
const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All types" },
  // primary-network staking
  { value: "AddPermissionlessValidatorTx", label: "Add Validator" },
  { value: "AddPermissionlessDelegatorTx", label: "Add Delegator" },
  { value: "RewardValidatorTx", label: "Reward" },
  // auto-renewed staking (ACP-236, Helicon): a cycle-based stake, the
  // consensus-issued reward at each cycle end, and owner config changes
  { value: "AddAutoRenewedValidatorTx", label: "Auto-Renew Validator" },
  { value: "RewardAutoRenewedValidatorTx", label: "Auto-Renew Reward" },
  { value: "SetAutoRenewedValidatorConfigTx", label: "Auto-Renew Config" },
  // L1 lifecycle
  { value: "ConvertSubnetToL1Tx", label: "Convert to L1" },
  { value: "RegisterL1ValidatorTx", label: "Register L1 Validator" },
  { value: "SetL1ValidatorWeightTx", label: "Set L1 Weight" },
  { value: "IncreaseL1ValidatorBalanceTx", label: "Increase L1 Balance" },
  { value: "DisableL1ValidatorTx", label: "Disable L1 Validator" },
  // creation
  { value: "CreateSubnetTx", label: "Create Subnet" },
  { value: "CreateChainTx", label: "Create Chain" },
  // value movement
  { value: "ImportTx", label: "Import" },
  { value: "ExportTx", label: "Export" },
  { value: "BaseTx", label: "Transfer" },
];

export function PchainTxsList({ chain, network }: { chain: string; network: string }) {
  const base = `/explorer/${network}/${chain}`;
  const [limit, setLimit] = useState(50);
  const [type, setType] = useState("");
  const { data, loading } = usePchainData<TxSummary[]>(network, "txs", { limit, type: type || undefined }, { refreshMs: LIVE_REFRESH_MS });
  const txs = data ?? [];
  const activeLabel = TYPE_OPTIONS.find((o) => o.value === type)?.label ?? "All types";

  return (
    <ExplorerShell chain={chain} network={network}>
      <section className="flex flex-col gap-4">
        <SectionHeader
          label="Transactions"
          action={
            type ? (
              <button
                onClick={() => {
                  setType("");
                  setLimit(50);
                }}
                className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-[#E6212F] dark:text-zinc-500"
              >
                Clear filter ✕
              </button>
            ) : undefined
          }
        />
        <TypeFilterRail
          options={TYPE_OPTIONS}
          value={type}
          onChange={(v) => {
            setType(v);
            setLimit(50);
          }}
        />
        <Board className={cn(loading && txs.length > 0 && "opacity-60 transition-opacity")}>
          <div className="hidden grid-cols-[2fr_1.2fr_0.8fr_0.7fr] gap-4 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:text-zinc-500">
            <span>Hash</span>
            <span>Type</span>
            <span className="text-right">Block</span>
            <span className="text-right">Age</span>
          </div>
          {txs.map((t) => (
            <Link
              key={t.txHash}
              href={`${base}/tx/${t.txHash}`}
              className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-zinc-50 md:grid-cols-[2fr_1.2fr_0.8fr_0.7fr] md:items-center md:px-6 dark:hover:bg-zinc-900"
            >
              <span className={`truncate font-mono text-[12px] ${idInk}`}>
                {truncate(t.txHash, 16)}
              </span>
              <span className="justify-self-start">
                <TxTypePill type={t.txType.replace(/Tx$/, "")} />
              </span>
              <div className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                <CellLabel>Block</CellLabel>
                #{formatNumber(t.blockHeight)}
              </div>
              <div className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                <CellLabel>Age</CellLabel>
                {timeAgo(t.blockTimestamp)}
              </div>
            </Link>
          ))}
          {loading && <div className="px-5 py-4 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">Loading…</div>}
          {!loading && txs.length === 0 && (
            <div className="flex items-baseline gap-3 px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">
              {type ? `No recent ${activeLabel} transactions` : "no transactions"}
              {type && (
                <button
                  onClick={() => {
                    setType("");
                    setLimit(50);
                  }}
                  className="uppercase tracking-[0.12em] text-zinc-500 underline-offset-4 transition-colors hover:text-[#E6212F] hover:underline dark:text-zinc-400"
                >
                  Show all
                </button>
              )}
            </div>
          )}
        </Board>
        {!loading && txs.length >= limit && (
          <button
            onClick={() => setLimit((l) => l + 50)}
            className="mx-auto border border-zinc-200 px-5 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
          >
            Load more
          </button>
        )}
      </section>
    </ExplorerShell>
  );
}
