"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import {
  Board,
  HashChip,
  SectionHeader,
  SpecPlate,
  SpecRow,
  TxTypePill,
} from "@/components/explorer-v2/ui";
import { formatAvax, formatTime, timeAgo, truncate } from "@/components/explorer-v2/format";
import { usePchainData } from "./hooks";
import { FundFlowDiagram, NoFundMovement, hasFundMovement } from "./FundFlowDiagram";
import { knownChainName } from "@/lib/pchain-explorer";
import type { AssetAmount, Tx, Utxo } from "@/lib/pchain-explorer";

export function PchainTx({ chain, network, txHash }: { chain: string; network: string; txHash: string }) {
  const base = `/explorer/${network}/${chain}`;
  const { data: tx, loading, error } = usePchainData<Tx>(network, `tx/${txHash}`);
  const [flowView, setFlowView] = useState<"diagram" | "table">("diagram");

  return (
    <ExplorerShell chain={chain} network={network}>
      {loading && <DetailSkeleton />}
      {error && <NotFound label="Transaction not found" id={txHash} />}
      {tx && (
        <div className="flex flex-col gap-10">
          {/* Overview */}
          <section className="flex flex-col gap-4">
            <SectionHeader label="Transaction" action={<TxTypePill type={tx.txType} />} />
            <Board divide={false} className="px-5 py-4 md:px-6">
              <SpecPlate>
                <SpecRow label="Hash">
                  <HashChip value={tx.txHash} len={64} />
                </SpecRow>
                <SpecRow label="Type">{tx.txType}</SpecRow>
                <SpecRow label="Block">
                  <HashChip value={tx.blockNumber} href={`${base}/block/${tx.blockNumber}`} mono len={20} />
                </SpecRow>
                <SpecRow label="Timestamp">
                  {formatTime(tx.blockTimestamp)} · {timeAgo(tx.blockTimestamp)}
                </SpecRow>
                {tx.memo && tx.memo !== "0x" && <SpecRow label="Memo">{truncate(tx.memo, 40)}</SpecRow>}
              </SpecPlate>
            </Board>
          </section>

          {/* Value rollups */}
          <RollupStrip value={tx.value} staked={tx.amountStaked} burned={tx.amountBurned} />

          {/* Staking */}
          {(tx.nodeId || tx.details?.weight || tx.rewardAddresses?.length) && (
            <Section label="Staking">
              <SpecPlate>
                {tx.nodeId && (
                  <SpecRow label="Node ID">
                    <HashChip value={tx.nodeId} href={`${base}/node/${tx.nodeId}`} len={32} />
                  </SpecRow>
                )}
                {tx.subnetId && (
                  <SpecRow label="Subnet ID">
                    <HashChip value={tx.subnetId} len={32} />
                  </SpecRow>
                )}
                {tx.details?.weight !== undefined && (
                  <SpecRow label="Weight / Stake">{formatAvax(tx.details.weight)}</SpecRow>
                )}
                {tx.details?.delegationFeePercent !== undefined && (
                  <SpecRow label="Delegation Fee">{tx.details.delegationFeePercent}%</SpecRow>
                )}
                {tx.startTimestamp !== undefined && tx.startTimestamp > 0 && (
                  <SpecRow label="Start">{formatTime(tx.startTimestamp)}</SpecRow>
                )}
                {tx.endTimestamp !== undefined && tx.endTimestamp > 0 && (
                  <SpecRow label="End">{formatTime(tx.endTimestamp)}</SpecRow>
                )}
                {tx.estimatedReward && <SpecRow label="Est. Reward">{formatAvax(tx.estimatedReward)}</SpecRow>}
                {tx.details?.rewardPaid !== undefined && (
                  <SpecRow label="Reward Paid">{tx.details.rewardPaid ? "Yes (committed)" : "No (aborted)"}</SpecRow>
                )}
                {tx.details?.stakingTxId && (
                  <SpecRow label="Staking Tx">
                    <HashChip value={tx.details.stakingTxId} href={`${base}/tx/${tx.details.stakingTxId}`} len={20} />
                  </SpecRow>
                )}
                {tx.rewardAddresses?.length ? (
                  <SpecRow label="Reward Owners" align="start">
                    <AddrList base={base} addrs={tx.rewardAddresses} />
                  </SpecRow>
                ) : null}
              </SpecPlate>
            </Section>
          )}

          {/* L1 (ACP-77) */}
          {(tx.details?.validationId || tx.details?.l1Balance !== undefined || tx.details?.blsPublicKey) && (
            <Section label="L1 Validation">
              <SpecPlate>
                {tx.details?.validationId && (
                  <SpecRow label="Validation ID">
                    <HashChip value={tx.details.validationId} len={32} />
                  </SpecRow>
                )}
                {tx.details?.l1Balance !== undefined && (
                  <SpecRow label="L1 Balance">{formatAvax(tx.details.l1Balance)}</SpecRow>
                )}
                {tx.details?.blsPublicKey && (
                  <SpecRow label="BLS Public Key">{truncate(tx.details.blsPublicKey, 30)}</SpecRow>
                )}
              </SpecPlate>
            </Section>
          )}

          {/* Subnet / Chain creation */}
          {(tx.details?.chainName || tx.details?.vmId || tx.details?.subnetOwners?.length) && (
            <Section label="Subnet / Chain">
              <SpecPlate>
                {tx.details?.chainName && <SpecRow label="Chain Name">{tx.details.chainName}</SpecRow>}
                {tx.details?.vmId && (
                  <SpecRow label="VM ID">
                    <HashChip value={tx.details.vmId} len={24} />
                  </SpecRow>
                )}
                {tx.details?.genesisDataHash && (
                  <SpecRow label="Genesis Hash">{truncate(tx.details.genesisDataHash, 24)}</SpecRow>
                )}
                {tx.details?.subnetThreshold !== undefined && (
                  <SpecRow label="Threshold">{tx.details.subnetThreshold}</SpecRow>
                )}
                {tx.details?.subnetOwners?.length ? (
                  <SpecRow label="Subnet Owners" align="start">
                    <AddrList base={base} addrs={tx.details.subnetOwners} />
                  </SpecRow>
                ) : null}
              </SpecPlate>
            </Section>
          )}

          {/* Cross-chain (import/export provenance) */}
          {(tx.details?.sourceChain || tx.details?.destinationChain || tx.importedFrom) && (
            <Section label="Cross-Chain">
              <SpecPlate>
                {tx.details?.sourceChain && (
                  <SpecRow label="Source Chain">
                    <ChainCell id={tx.details.sourceChain} name={tx.importedFrom?.chainName} />
                  </SpecRow>
                )}
                {tx.details?.destinationChain && (
                  <SpecRow label="Destination Chain">
                    <ChainCell id={tx.details.destinationChain} />
                  </SpecRow>
                )}
                {tx.importedFrom?.exports?.map((exp, i) => (
                  <Fragment key={exp.txHash || i}>
                    {exp.amount && <SpecRow label="Imported Amount">{formatAvax(exp.amount)}</SpecRow>}
                    {exp.evmSenders?.map((a) => (
                      <SpecRow key={a} label="Funder Address">
                        <HashChip value={a} len={20} />
                      </SpecRow>
                    ))}
                    <SpecRow label="Transaction Hash">
                      <HashChip value={exp.txHash} len={20} />
                    </SpecRow>
                  </Fragment>
                ))}
              </SpecPlate>
            </Section>
          )}

          {/* Fund flow: diagram (default) or ledger table */}
          <section className="flex flex-col gap-4">
            <SectionHeader
              label="Fund Flow"
              action={
                <div className="inline-flex border border-zinc-200 dark:border-zinc-800">
                  {(["diagram", "table"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setFlowView(v)}
                      className={cn(
                        "px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors",
                        flowView === v
                          ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                          : "text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900",
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              }
            />
            {!hasFundMovement({
              consumed: tx.consumedUtxos,
              emitted: tx.emittedUtxos,
              burned: tx.amountBurned,
              importedFrom: tx.importedFrom,
              sourceChain: tx.details?.sourceChain,
              destinationChain: tx.details?.destinationChain,
            }) ? (
              <Board divide={false} className="px-5 py-6 md:px-6">
                <NoFundMovement txType={tx.txType} />
              </Board>
            ) : flowView === "diagram" ? (
              <Board divide={false} className="px-5 py-6 md:px-6">
                <FundFlowDiagram
                  consumed={tx.consumedUtxos}
                  emitted={tx.emittedUtxos}
                  burned={tx.amountBurned}
                  txType={tx.txType}
                  base={base}
                  importedFrom={tx.importedFrom}
                  sourceChain={tx.details?.sourceChain}
                  destinationChain={tx.details?.destinationChain}
                />
              </Board>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                <UtxoColumn base={base} title={`Consumed · ${tx.consumedUtxos.length}`} utxos={tx.consumedUtxos} side="in" />
                <UtxoColumn base={base} title={`Emitted · ${tx.emittedUtxos.length}`} utxos={tx.emittedUtxos} side="out" />
              </div>
            )}
          </section>
        </div>
      )}
    </ExplorerShell>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader label={label} />
      <Board divide={false} className="px-5 py-4 md:px-6">
        {children}
      </Board>
    </section>
  );
}

function RollupStrip({ value, staked, burned }: { value: AssetAmount[]; staked: AssetAmount[]; burned: AssetAmount[] }) {
  const sum = (arr: AssetAmount[]) => arr.reduce((t, a) => t + Number(a.amount || 0), 0);
  const cells: { label: string; v: number }[] = [
    { label: "VALUE", v: sum(value) },
    { label: "STAKED", v: sum(staked) },
    { label: "BURNED", v: sum(burned) },
  ];
  return (
    <Board divide={false}>
      <div className="grid grid-cols-1 divide-y divide-zinc-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-zinc-800">
        {cells.map((c) => (
          <div key={c.label} className="flex flex-col gap-1.5 px-5 py-5 md:px-6">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              {c.label}
            </span>
            <span className="font-mono text-xl tabular-nums tracking-tight text-zinc-900 dark:text-zinc-50">
              {formatAvax(c.v)}
            </span>
          </div>
        ))}
      </div>
    </Board>
  );
}

function UtxoColumn({ base, title, utxos, side }: { base: string; title: string; utxos: Utxo[]; side: "in" | "out" }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        {side === "in" ? "▸ " : ""}
        {title}
        {side === "out" ? " ▸" : ""}
      </p>
      <Board>
        {utxos.length === 0 && (
          <div className="px-5 py-5 font-mono text-[11px] text-zinc-400 dark:text-zinc-500 md:px-6">— none —</div>
        )}
        {utxos.map((u) => (
          <div key={u.utxoId} className="flex flex-col gap-1.5 px-5 py-3 md:px-6">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[12px] tabular-nums text-zinc-900 dark:text-zinc-100">
                {formatAvax(u.amount)}
              </span>
              <div className="flex items-center gap-2">
                {u.staked && (
                  <span className="border border-[#E6212F]/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[#E6212F]">
                    staked
                  </span>
                )}
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500">
                  {u.utxoType}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              {u.addresses.map((a) => (
                <Link
                  key={a}
                  href={`${base}/address/${a}`}
                  className="font-mono text-[11px] text-zinc-500 underline-offset-2 hover:text-[#E6212F] hover:underline dark:text-zinc-400"
                >
                  {truncate(a, 14)}
                </Link>
              ))}
            </div>
            {u.consumingTxHash && side === "out" && (
              <Link
                href={`${base}/tx/${u.consumingTxHash}`}
                className="font-mono text-[10px] text-zinc-400 hover:text-[#E6212F] dark:text-zinc-500"
              >
                spent in {truncate(u.consumingTxHash, 12)} →
              </Link>
            )}
          </div>
        ))}
      </Board>
    </div>
  );
}

/* Cross-chain endpoint: show the friendly name for known chains (C/X-Chain),
   else a copyable full blockchain ID. */
function ChainCell({ id, name }: { id: string; name?: string }) {
  const label = name ?? knownChainName(id);
  if (label) {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.08em] text-zinc-900 dark:text-zinc-50">
        <span className="size-1 bg-[#0891B2]" aria-hidden />
        {label}
      </span>
    );
  }
  return <HashChip value={id} len={20} />;
}

function AddrList({ base, addrs }: { base: string; addrs: string[] }) {
  return (
    <div className="flex flex-col items-end gap-1">
      {addrs.map((a) => (
        <HashChip key={a} value={a} href={`${base}/address/${a}`} len={20} />
      ))}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-4 w-full max-w-lg animate-pulse bg-zinc-100 dark:bg-zinc-900" />
      ))}
    </div>
  );
}

export function NotFound({ label, id }: { label: string; id?: string }) {
  return (
    <Board divide={false} className="px-6 py-16 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">{label}</p>
      {id && <p className="mt-2 font-mono text-[11px] text-zinc-400 dark:text-zinc-600">{truncate(id, 24)}</p>}
    </Board>
  );
}
