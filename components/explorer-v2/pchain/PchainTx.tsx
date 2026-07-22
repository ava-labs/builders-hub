"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  PRIMARY_SUBNET_ID,
  bytesToHex,
  decodeL1WarpMessage,
  getPlatformTx,
  hexToNodeId,
  type DecodedL1WarpMessage,
  type L1InitialValidator,
  type PlatformUnsignedTx,
} from "@/lib/pchain-node";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import {
  Board,
  DetailSkeleton,
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
  // a fresh tx exists on-chain seconds before the indexer has it: keep
  // re-checking a 404 for two minutes instead of declaring it missing
  const { data: tx, loading, error } = usePchainData<Tx>(network, `tx/${txHash}`, undefined, {
    retry404Ms: 120_000,
  });
  const [flowView, setFlowView] = useState<"diagram" | "table">("diagram");
  const notFound = error === "not found";

  // which context sections this tx type carries — they lay out two-up.
  // A reward or auto-renew config tx points at its staking tx without
  // carrying a node/weight of its own — that link still earns the panel.
  const hasStaking = !!(
    tx &&
    (tx.nodeId ||
      tx.details?.weight ||
      tx.rewardAddresses?.length ||
      tx.details?.stakingTxId ||
      tx.details?.rewardPaid !== undefined)
  );
  // continuous staking (Granite): the stake renews itself on a period,
  // optionally compounding rewards back in
  const hasContinuous = !!(
    tx &&
    ((tx.period ?? 0) > 0 ||
      tx.autoCompoundRewardShares !== undefined ||
      tx.autoCompoundPercent !== undefined ||
      tx.validatorAuthority?.length)
  );
  const hasL1Validation = !!(
    tx && (tx.details?.validationId || tx.details?.l1Balance !== undefined || tx.details?.blsPublicKey)
  );
  const hasCreation = !!(tx && (tx.details?.chainName || tx.details?.vmId || tx.details?.subnetOwners?.length));
  const hasCrossChain = !!(tx && (tx.details?.sourceChain || tx.details?.destinationChain || tx.importedFrom));
  const isConvert = tx?.txType === "ConvertSubnetToL1Tx";
  const isWarpOp = tx?.txType === "RegisterL1ValidatorTx" || tx?.txType === "SetL1ValidatorWeightTx";
  const hasContext =
    hasStaking || hasContinuous || hasL1Validation || hasCreation || hasCrossChain || isConvert || isWarpOp;

  // node-decoded inputs for platform ops (shared by the right-rail panels
  // and the full-width initial-validator-set table); on a 404 it doubles
  // as the authoritative "does this tx exist on-chain at all?" check
  const platformOp = usePlatformTx(network, txHash, isConvert || isWarpOp || notFound);

  return (
    <ExplorerShell chain={chain} network={network}>
      {loading && <DetailSkeleton label="Transaction" />}
      {error && !notFound && <NotFound label="Transaction not found" id={txHash} />}
      {notFound &&
        (platformOp.data ? (
          <IndexingWait txHash={txHash} />
        ) : platformOp.loading ? (
          <DetailSkeleton label="Transaction" />
        ) : (
          <NotFound label="Transaction not found" id={txHash} />
        ))}
      {tx && (
        <div className="flex flex-col gap-10">
          {/* identity on the left, type-specific context on the right;
              the fund flow runs full-width below both rails */}
          <div className={hasContext ? "grid items-start gap-x-8 gap-y-10 lg:grid-cols-2" : "flex flex-col gap-10"}>
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
                {/* a CreateSubnetTx's ID IS the subnet ID; a CreateChainTx's
                    ID IS the blockchain ID — surface the identity, don't make
                    the reader know the convention */}
                {tx.txType === "CreateSubnetTx" && (
                  <SpecRow label="Subnet ID · created">
                    <HashChip value={tx.txHash} len={32} />
                  </SpecRow>
                )}
                {tx.txType === "CreateChainTx" && (
                  <SpecRow label="Blockchain ID · created">
                    <span className="inline-flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                      <HashChip value={tx.txHash} len={32} />
                      <Link
                        href={`${base}/chain/${tx.txHash}`}
                        className="group inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-[#E6212F] dark:text-zinc-500"
                      >
                        Chain page →
                      </Link>
                    </span>
                  </SpecRow>
                )}
                <SpecRow label="Block">
                  <HashChip value={tx.blockNumber} href={`${base}/block/${tx.blockNumber}`} mono len={20} />
                </SpecRow>
                <SpecRow label="Timestamp">
                  {formatTime(tx.blockTimestamp)} · {timeAgo(tx.blockTimestamp)}
                </SpecRow>
                <SpecRow label="Value">{formatAvax(sumAmounts(tx.value))}</SpecRow>
                {sumAmounts(tx.amountStaked) > 0 && (
                  <SpecRow label="Staked">{formatAvax(sumAmounts(tx.amountStaked))}</SpecRow>
                )}
                <SpecRow label="Burned · fee">{formatAvax(sumAmounts(tx.amountBurned))}</SpecRow>
                {tx.memo && tx.memo !== "0x" && (
                  <SpecRow label="Memo">
                    <HashChip value={tx.memo} len={40} />
                  </SpecRow>
                )}
              </SpecPlate>
            </Board>
          </section>
          </div>

          {/* right rail: what this tx type is actually about */}
          {hasContext && (
          <div className="flex flex-col gap-10">

          {/* Staking */}
          {hasStaking && (
            <Section label="Staking">
              <SpecPlate>
                {tx.nodeId && (
                  <SpecRow label="Node ID">
                    <HashChip value={tx.nodeId} href={`${base}/node/${tx.nodeId}`} len={32} />
                  </SpecRow>
                )}
                {tx.subnetId && (
                  <SpecRow label="Subnet ID">
                    <SubnetChip base={base} subnetId={tx.subnetId} />
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

          {/* Continuous staking (Granite auto-renew family) */}
          {hasContinuous && (
            <Section label="Continuous Staking">
              <SpecPlate>
                {(tx.period ?? 0) > 0 && (
                  <SpecRow label="Renews Every">
                    {tx.periodHuman ?? humanPeriod(tx.period!)}
                    <span className="ml-2 text-zinc-400 dark:text-zinc-500">
                      {tx.period!.toLocaleString("en-US")}s
                    </span>
                  </SpecRow>
                )}
                {autoCompoundPct(tx) !== null && (
                  <SpecRow label="Auto-Compound">
                    {autoCompoundPct(tx)}% of each reward restakes
                  </SpecRow>
                )}
                {tx.validatorAuthority?.length ? (
                  <SpecRow label="Config Authority" align="start">
                    <AddrList base={base} addrs={tx.validatorAuthority} />
                  </SpecRow>
                ) : null}
              </SpecPlate>
            </Section>
          )}

          {/* L1 (ACP-77) */}
          {hasL1Validation && !isWarpOp && (
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
                  <SpecRow label="BLS Public Key">
                    <HashChip value={tx.details.blsPublicKey} len={30} />
                  </SpecRow>
                )}
              </SpecPlate>
            </Section>
          )}

          {/* Subnet / Chain creation */}
          {hasCreation && (
            <Section label="Subnet / Chain">
              <SpecPlate>
                {tx.details?.chainName && <SpecRow label="Chain Name">{tx.details.chainName}</SpecRow>}
                {tx.subnetId && tx.txType !== "CreateSubnetTx" && (
                  <SpecRow label="Subnet ID">
                    <SubnetChip base={base} subnetId={tx.subnetId} />
                  </SpecRow>
                )}
                {tx.details?.vmId && (
                  <SpecRow label="VM ID">
                    <HashChip value={tx.details.vmId} len={24} />
                  </SpecRow>
                )}
                {tx.details?.genesisDataHash && (
                  <SpecRow label="Genesis Hash">
                    <HashChip value={tx.details.genesisDataHash} len={24} />
                  </SpecRow>
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
          {hasCrossChain && (
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

          {/* ConvertSubnetToL1: the submitted inputs, decoded by the node —
              manager pointers (the indexer doesn't carry these) */}
          {isConvert && (platformOp.loading || platformOp.data) && (
            <ConversionSpec u={platformOp.data} loading={platformOp.loading} subnetId={tx.subnetId} base={base} />
          )}

          {/* the conversion's initial validator set rides with its spec card */}
          {isConvert && (platformOp.data?.validators?.length ?? 0) > 0 && (
            <InitialValidatorSet validators={platformOp.data!.validators!} subnetId={tx.subnetId} base={base} />
          )}

          {/* Register / SetWeight: the signed Warp message IS the payload —
              decode it (subnet, node, BLS key, expiry, owners, weight) and
              expose the raw signed bytes + proof of possession */}
          {isWarpOp && (platformOp.loading || platformOp.data) && (
            <L1WarpPanel u={platformOp.data} loading={platformOp.loading} base={base} />
          )}

          </div>
          )}
          </div>

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

/* The tx is on-chain (the node confirms it) but the indexer hasn't
   ingested it yet — the page keeps re-checking and swaps in the full
   view the moment it lands. */
function IndexingWait({ txHash }: { txHash: string }) {
  return (
    <Board divide={false} className="px-6 py-14 text-center">
      <div className="flex flex-col items-center gap-4">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#E6212F] opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#E6212F]" />
        </span>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-900 dark:text-zinc-100">
          Accepted on-chain · indexing
        </p>
        <p className="max-w-md text-sm text-zinc-500 dark:text-zinc-400">
          The P-Chain has this transaction; the explorer index is a few blocks behind it. This page
          refreshes itself until it lands.
        </p>
        <HashChip value={txHash} len={40} />
      </div>
    </Board>
  );
}

/* A blockchain ID reference: known genesis chains (C/X) get their name —
   the C-Chain additionally hands off to its own explorer — and everything
   else links to its P-Chain chain page. */
function ChainRef({ id, base }: { id: string; base: string }) {
  const known = knownChainName(id);
  if (known === "C-Chain") {
    return (
      <span className="inline-flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
        <ChainCell id={id} />
        <Link
          href="/explorer/mainnet/c-chain"
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-[#E6212F] dark:text-zinc-500"
        >
          Explorer →
        </Link>
      </span>
    );
  }
  if (known) return <ChainCell id={id} />;
  return <HashChip value={id} href={`${base}/chain/${id}`} len={24} />;
}

/* Subnet IDs are CreateSubnetTx IDs, so they link straight to the tx that
   minted them — except the Primary Network's, which is implicit in genesis
   and has no transaction behind it. */
function SubnetChip({ base, subnetId }: { base: string; subnetId: string }) {
  return (
    <HashChip
      value={subnetId}
      href={subnetId !== PRIMARY_SUBNET_ID ? `${base}/tx/${subnetId}` : undefined}
      len={32}
    />
  );
}

/* One platform.getTx fetch per page, shared by every panel that needs the
   node-decoded inputs. Additive — if the RPC is unreachable (devnet has no
   public endpoint), data stays null and the panels don't render. */
function usePlatformTx(network: string, txHash: string, enabled: boolean) {
  const [data, setData] = useState<PlatformUnsignedTx | null>(null);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    getPlatformTx(network, txHash).then((u) => {
      if (cancelled) return;
      setData(u);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [network, txHash, enabled]);

  return { data, loading };
}

function PanelBones() {
  return (
    <Board divide={false} className="px-5 py-4 md:px-6">
      <div className="flex flex-col gap-3 py-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-3 w-2/3 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
        ))}
      </div>
    </Board>
  );
}

/* ConvertSubnetToL1Tx manager pointers — the right-rail spec card. */
function ConversionSpec({
  u,
  loading,
  subnetId,
  base,
}: {
  u: PlatformUnsignedTx | null;
  loading: boolean;
  subnetId?: string;
  base: string;
}) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader label="L1 Conversion" />
      {loading || !u ? (
        <PanelBones />
      ) : (
        <Board divide={false} className="px-5 py-4 md:px-6">
          <SpecPlate>
            {subnetId && (
              <SpecRow label="Subnet Converted">
                <SubnetChip base={base} subnetId={subnetId} />
              </SpecRow>
            )}
            {u.chainID && (
              <SpecRow label="Manager Chain">
                <ChainRef id={u.chainID} base={base} />
              </SpecRow>
            )}
            {u.address && (
              <SpecRow label="Validator Manager Contract">
                <HashChip value={u.address} len={24} />
              </SpecRow>
            )}
          </SpecPlate>
        </Board>
      )}
    </section>
  );
}

/* The conversion's initial validator set, exactly as submitted — rendered
   full-width below both rails. */
function InitialValidatorSet({
  validators,
  subnetId,
  base,
}: {
  validators: L1InitialValidator[];
  subnetId?: string;
  base: string;
}) {
  const [nodeIds, setNodeIds] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ids: Record<string, string> = {};
      await Promise.all(
        validators.map(async (v) => {
          ids[v.nodeID] = await hexToNodeId(v.nodeID);
        }),
      );
      if (!cancelled) setNodeIds(ids);
    })();
    return () => {
      cancelled = true;
    };
  }, [validators]);

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader label={`Initial Validator Set · ${validators.length}`} />
      <Board>
                <div className="hidden grid-cols-[1.6fr_0.6fr_0.8fr] gap-4 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 md:grid md:px-6 dark:text-zinc-500">
                  <span>Node</span>
                  <span className="text-right">Weight</span>
                  <span className="text-right">Balance</span>
                </div>
                {validators.map((v: L1InitialValidator) => {
                  const nodeId = nodeIds[v.nodeID];
                  return (
                    <div
                      key={v.nodeID}
                      className="grid grid-cols-2 gap-x-4 gap-y-1 px-5 py-3 md:grid-cols-[1.6fr_0.6fr_0.8fr] md:items-center md:px-6"
                    >
                      {nodeId ? (
                        <HashChip
                          value={nodeId}
                          href={`${base}/node/${nodeId}${subnetId ? `?subnet=${subnetId}` : ""}`}
                          len={16}
                        />
                      ) : (
                        <span className="font-mono text-[12px] text-zinc-400 dark:text-zinc-500">
                          {truncate(v.nodeID, 14)}
                        </span>
                      )}
                      <span className="font-mono text-[13px] font-medium tabular-nums text-zinc-700 md:text-right dark:text-zinc-300">
                        {v.weight.toLocaleString("en-US")}
                      </span>
                      <span className="font-mono text-[13px] tabular-nums text-zinc-500 md:text-right dark:text-zinc-400">
                        {formatAvax(v.balance)}
                      </span>
                    </div>
                  );
                })}
              </Board>
    </section>
  );
}

/* RegisterL1ValidatorTx / SetL1ValidatorWeightTx: the payload lives inside
   a signed Warp message the indexer stores as opaque bytes. Decode the
   AddressedCall and lay out the actual inputs — plus the raw signed
   message and BLS proof of possession for anyone who wants to verify. */
function L1WarpPanel({
  u,
  loading,
  base,
}: {
  u: PlatformUnsignedTx | null;
  loading: boolean;
  base: string;
}) {
  const [decoded, setDecoded] = useState<DecodedL1WarpMessage | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (u?.message) {
      decodeL1WarpMessage(u.message).then((d) => !cancelled && setDecoded(d));
    } else {
      setDecoded(null);
    }
    return () => {
      cancelled = true;
    };
  }, [u]);

  const raw = u;
  const pop = Array.isArray(raw?.proofOfPossession)
    ? bytesToHex(raw.proofOfPossession)
    : raw?.proofOfPossession;

  return (
    <Section label={decoded?.kind === "weight" ? "L1 Weight Update" : "L1 Validator Registration"}>
      {loading || !raw ? (
        <div className="flex flex-col gap-3 py-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-3 w-2/3 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
          ))}
        </div>
      ) : (
        <SpecPlate>
          {decoded?.kind === "register" && (
            <>
              <SpecRow label="Subnet">
                <SubnetChip base={base} subnetId={decoded.subnetId} />
              </SpecRow>
              <SpecRow label="Node ID">
                <HashChip
                  value={decoded.nodeId}
                  href={`${base}/node/${decoded.nodeId}?subnet=${decoded.subnetId}`}
                  len={24}
                />
              </SpecRow>
              <SpecRow label="Weight">{decoded.weight.toLocaleString("en-US")}</SpecRow>
              {raw.balance !== undefined && (
                <SpecRow label="Initial Balance">{formatAvax(raw.balance)}</SpecRow>
              )}
              <SpecRow label="Registration Expiry">
                {formatTime(decoded.expiry)} · {timeAgo(decoded.expiry)}
              </SpecRow>
              <SpecRow label="BLS Public Key">
                <HashChip value={decoded.blsPublicKey} len={24} />
              </SpecRow>
              {pop && (
                <SpecRow label="BLS Proof of Possession">
                  <HashChip value={pop} len={24} />
                </SpecRow>
              )}
              <SpecRow label="Remaining Balance Owner" align="start">
                <OwnerCell owner={decoded.remainingBalanceOwner} />
              </SpecRow>
              <SpecRow label="Deactivation Owner" align="start">
                <OwnerCell owner={decoded.disableOwner} />
              </SpecRow>
            </>
          )}
          {decoded?.kind === "weight" && (
            <>
              <SpecRow label="Validation ID">
                <HashChip value={decoded.validationId} len={24} />
              </SpecRow>
              <SpecRow label="New Weight">{decoded.weight.toLocaleString("en-US")}</SpecRow>
              <SpecRow label="Nonce">{decoded.nonce.toLocaleString("en-US")}</SpecRow>
            </>
          )}
          {decoded && (
            <>
              <SpecRow label="Manager Chain">
                <ChainRef id={decoded.sourceChainId} base={base} />
              </SpecRow>
              <SpecRow label="Validator Manager Contract">
                <HashChip value={decoded.sourceAddress} len={24} />
              </SpecRow>
            </>
          )}
          {raw.message && (
            <SpecRow label={`Signed Warp Message · ${Math.floor((raw.message.length - 2) / 2)} bytes`}>
              <HashChip value={raw.message} len={24} />
            </SpecRow>
          )}
        </SpecPlate>
      )}
    </Section>
  );
}

function OwnerCell({ owner }: { owner: { threshold: number; addresses: string[] } }) {
  return (
    <span className="flex flex-col items-end gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
        threshold {owner.threshold} of {owner.addresses.length}
      </span>
      {owner.addresses.map((a) => (
        <HashChip key={a} value={a} len={20} />
      ))}
    </span>
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

function sumAmounts(arr: AssetAmount[]): number {
  return arr.reduce((t, a) => t + Number(a.amount || 0), 0);
}

/* fallback when the API sends only raw seconds — largest unit that
   divides the period evenly, mirroring the API's periodHuman */
function humanPeriod(secs: number): string {
  const units: [number, string][] = [
    [604800, "week"],
    [86400, "day"],
    [3600, "hour"],
    [60, "minute"],
  ];
  for (const [size, name] of units) {
    if (secs >= size && secs % size === 0) {
      const n = secs / size;
      return `${n} ${name}${n === 1 ? "" : "s"}`;
    }
  }
  return `${secs}s`;
}

/* auto-compound share of each reward, whichever encoding the API sent —
   percent directly, or raw shares in parts-per-million (1,000,000 = 100%) */
function autoCompoundPct(tx: Tx): string | null {
  const pct =
    tx.autoCompoundPercent ??
    (tx.autoCompoundRewardShares !== undefined ? tx.autoCompoundRewardShares / 10_000 : undefined);
  if (pct === undefined) return null;
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(2);
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
          <div className="px-5 py-5 font-mono text-[11px] text-zinc-400 dark:text-zinc-500 md:px-6">none</div>
        )}
        {utxos.map((u, i) => (
          <div key={`${u.utxoId}-${i}`} className="flex flex-col gap-1.5 px-5 py-3 md:px-6">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[13px] font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
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
                  className="font-mono text-[11px] text-[#0061E2] underline-offset-2 hover:text-[#E6212F] hover:underline dark:text-[#5f9dff]"
                >
                  {truncate(a, 14)}
                </Link>
              ))}
            </div>
            {u.consumingTxHash && side === "out" && (
              <Link
                href={`${base}/tx/${u.consumingTxHash}`}
                className="font-mono text-[10px] text-[#0061E2] hover:text-[#E6212F] dark:text-[#5f9dff]"
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
      <span className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-zinc-900 dark:text-zinc-50">
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

export function NotFound({ label, id }: { label: string; id?: string }) {
  return (
    <Board divide={false} className="px-6 py-16 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">{label}</p>
      {id && <p className="mt-2 font-mono text-[11px] text-zinc-400 dark:text-zinc-600">{truncate(id, 24)}</p>}
    </Board>
  );
}
