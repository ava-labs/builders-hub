"use client";

import Link from "next/link";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import {
  Board,
  CellLabel,
  DetailSkeleton,
  HashChip,
  SectionHeader,
  SpecPlate,
  SpecRow,
  TxTypePill,
} from "@/components/explorer-v2/ui";
import { formatAvax, formatNumber, formatTime, timeAgo, truncate } from "@/components/explorer-v2/format";
import { usePchainData } from "./hooks";
import { NotFound } from "./PchainTx";
import type { Address, AddressTxs } from "@/lib/pchain-explorer";

/* Address view in the two-rail grammar the tx pages use: identity, balance
   composition, and holdings on the left; the activity ledger on the right.
   Long lists (txs, UTXOs) scroll inside their boards so no single section
   can run the page off the sheet. */

const BALANCE_TONES = {
  unlocked: "bg-[#A2AFB2]",
  locked: "bg-zinc-300 dark:bg-zinc-600",
  staked: "bg-[#E6212F]",
} as const;

export function PchainAddress({ chain, network, addr }: { chain: string; network: string; addr: string }) {
  const base = `/explorer/${network}/${chain}`;
  const { data: a, loading, error } = usePchainData<Address>(network, `address/${addr}`);
  const { data: history } = usePchainData<AddressTxs>(network, `address/${addr}/txs`, { limit: 50 });

  const totalRaw = a ? Number(a.balance.total) : 0;
  const composition = a
    ? ([
        { key: "unlocked" as const, label: "Unlocked", raw: Number(a.balance.unlocked) },
        { key: "locked" as const, label: "Locked", raw: Number(a.balance.locked) },
        { key: "staked" as const, label: "Staked", raw: Number(a.balance.staked) },
      ] as const)
    : [];

  return (
    <ExplorerShell chain={chain} network={network}>
      {loading && <DetailSkeleton label="Address" />}
      {error && <NotFound label="Address not found" id={addr} />}
      {a && (
        <div className="grid items-start gap-x-8 gap-y-10 lg:grid-cols-[1fr_1.45fr]">
          {/* ---------------- left rail: who this address is ---------------- */}
          <div className="flex flex-col gap-10">
            {/* identity + provenance in one plate — the old page spent a full
                section of whitespace on "first funded by" alone */}
            <section className="flex flex-col gap-4">
              <SectionHeader label="Address" />
              <Board divide={false} className="px-5 py-4 md:px-6">
                <SpecPlate>
                  <SpecRow label="Address">
                    <HashChip value={a.address} len={26} />
                  </SpecRow>
                  <SpecRow label="Unspent UTXOs">{formatNumber(a.utxoCount)}</SpecRow>
                  {a.fundedBy && (
                    <>
                      <SpecRow label="First funded">
                        {formatAvax(a.fundedBy.amount)} · {timeAgo(a.fundedBy.blockTimestamp)}
                      </SpecRow>
                      <SpecRow label="Funding tx">
                        <HashChip value={a.fundedBy.txHash} href={`${base}/tx/${a.fundedBy.txHash}`} len={16} />
                      </SpecRow>
                      {a.fundedBy.funders.length > 0 && (
                        <SpecRow label="Funded from" align="start">
                          <span className="flex flex-col items-end gap-1">
                            {a.fundedBy.funders.map((f) => (
                              <HashChip key={f} value={f} href={`${base}/address/${f}`} len={16} />
                            ))}
                          </span>
                        </SpecRow>
                      )}
                    </>
                  )}
                </SpecPlate>
              </Board>
            </section>

            {/* balance — one hero figure, then the composition bar shows at a
                glance where the AVAX sits (red = staked, at work) */}
            <section className="flex flex-col gap-4">
              <SectionHeader label="Balance" />
              <Board divide={false} className="flex flex-col gap-5 px-5 py-5 md:px-6">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-3xl tabular-nums tracking-tight text-zinc-900 md:text-[2.25rem] dark:text-zinc-50">
                    {formatAvax(a.balance.total, { symbol: false })}
                  </span>
                  <span className="font-mono text-sm text-zinc-400 dark:text-zinc-500">AVAX</span>
                </div>
                {totalRaw > 0 && (
                  <div className="flex h-2 w-full overflow-hidden" aria-hidden>
                    {composition
                      .filter((p) => p.raw > 0)
                      .map((p) => (
                        <span
                          key={p.key}
                          className={BALANCE_TONES[p.key]}
                          style={{ width: `${(p.raw / totalRaw) * 100}%` }}
                        />
                      ))}
                  </div>
                )}
                <dl className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {composition.map((p) => (
                    <div key={p.key} className="flex items-baseline justify-between gap-6 py-2.5">
                      <dt className="flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                        <span className={`h-2 w-2 shrink-0 ${BALANCE_TONES[p.key]}`} aria-hidden />
                        {p.label}
                      </dt>
                      <dd className="flex items-baseline gap-3 text-[13.5px] font-medium tabular-nums text-zinc-900 dark:text-zinc-50">
                        {formatAvax(p.raw)}
                        <span className="font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
                          {totalRaw > 0 ? `${((p.raw / totalRaw) * 100).toFixed(1)}%` : "—"}
                        </span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </Board>
            </section>

            {/* Unspent UTXOs — scrolls in place past ~8 rows */}
            <section className="flex flex-col gap-4">
              <SectionHeader label={`Unspent UTXOs · ${formatNumber(a.utxoCount)}`} />
              <Board className="max-h-[21rem] overflow-y-auto">
                {a.utxos.map((u, i) => (
                  <div key={`${u.utxoId}-${i}`} className="flex items-center justify-between gap-4 px-5 py-3 md:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="font-mono text-[12px] tabular-nums text-zinc-900 dark:text-zinc-100">
                        {formatAvax(u.amount)}
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">
                        {u.utxoKind}
                      </span>
                      {u.staked && (
                        <span className="border border-[#E6212F]/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[#E6212F]">
                          staked
                        </span>
                      )}
                    </div>
                    <Link
                      href={`${base}/block/${u.blockNumber}`}
                      className="shrink-0 font-mono text-[11px] tabular-nums text-[#0061E2] hover:text-[#E6212F] dark:text-[#5f9dff]"
                    >
                      #{formatNumber(Number(u.blockNumber))}
                    </Link>
                  </div>
                ))}
                {a.utxos.length === 0 && (
                  <div className="px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">
                    no unspent UTXOs
                  </div>
                )}
              </Board>
            </section>
          </div>

          {/* ---------------- right rail: what it has done ---------------- */}
          <section className="flex flex-col gap-4">
            <SectionHeader
              label={`Transactions${history ? ` · ${history.txs.length}${history.truncated ? "+" : ""}` : ""}`}
            />
            <Board className="max-h-[52rem] overflow-y-auto">
              <div className="sticky top-0 z-10 hidden grid-cols-[2fr_1.2fr_1fr_0.7fr] gap-4 bg-white px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:bg-zinc-950 dark:text-zinc-500">
                <span>Hash</span>
                <span>Type</span>
                <span className="text-right">Net</span>
                <span className="text-right">Age</span>
              </div>
              {(history?.txs ?? []).map((t) => {
                const net = Number(t.net);
                return (
                  <Link
                    key={t.txHash}
                    href={`${base}/tx/${t.txHash}`}
                    className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 transition-colors hover:bg-zinc-50 md:grid-cols-[2fr_1.2fr_1fr_0.7fr] md:items-center md:px-6 dark:hover:bg-zinc-900"
                  >
                    <span className="truncate font-mono text-[12px] text-zinc-900 dark:text-zinc-100">
                      {truncate(t.txHash, 16)}
                    </span>
                    <span className="justify-self-start">
                      <TxTypePill type={t.txType.replace(/Tx$/, "")} />
                    </span>
                    <div
                      className={`font-mono text-[11px] tabular-nums md:text-right ${
                        net > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : net < 0
                            ? "text-[#E6212F]"
                            : "text-zinc-500 dark:text-zinc-400"
                      }`}
                    >
                      <CellLabel>Net</CellLabel>
                      {net > 0 ? "+" : ""}
                      {formatAvax(t.net)}
                    </div>
                    <div
                      className="font-mono text-[11px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400"
                      title={formatTime(t.blockTimestamp)}
                    >
                      <CellLabel>Age</CellLabel>
                      {timeAgo(t.blockTimestamp)}
                    </div>
                  </Link>
                );
              })}
              {history && history.txs.length === 0 && (
                <div className="px-5 py-5 font-mono text-[11px] text-zinc-400 md:px-6 dark:text-zinc-500">
                  no transactions
                </div>
              )}
            </Board>
          </section>
        </div>
      )}
    </ExplorerShell>
  );
}
