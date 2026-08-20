"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { chainOfId, crossChainTxUrl, crossChainAddressUrl } from "@/lib/crosschain-links";
import {
  PRIMARY_SUBNET_ID,
  bytesToHex,
  decodeL1WarpMessage,
  getCurrentValidators,
  getL1Validator,
  getPlatformTx,
  getRewardUtxos,
  hexToNodeId,
  type DecodedL1WarpMessage,
  type L1InitialValidator,
  type L1ValidatorInfo,
  type PlatformUnsignedTx,
  type RewardUtxo,
} from "@/lib/pchain-node";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import {
  Board,
  DetailSkeleton,
  HashChip,
  SectionHeader,
  SpecPlate,
  SpecRow,
  SubjectHeadline,
  TxTypePill,
} from "@/components/explorer-v2/ui";
import { formatAvax, formatTime, timeAgo, truncate } from "@/components/explorer-v2/format";
import { usePchainData } from "./hooks";
import { GenesisViewer } from "./GenesisViewer";
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
  // continuous staking (Helicon): the stake renews itself on a period,
  // optionally compounding rewards back in
  const hasContinuous = !!(
    tx &&
    (tx.period !== undefined ||
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
  // a CreateChainTx carries the new chain's genesis — the node has the bytes
  const isCreateChain = tx?.txType === "CreateChainTx";
  const isWarpOp = tx?.txType === "RegisterL1ValidatorTx" || tx?.txType === "SetL1ValidatorWeightTx";
  const hasContext =
    hasStaking || hasContinuous || hasL1Validation || hasCreation || hasCrossChain || isConvert || isWarpOp;

  // node-decoded inputs for platform ops (shared by the right-rail panels
  // and the full-width initial-validator-set table); on a 404 it doubles
  // as the authoritative "does this tx exist on-chain at all?" check
  const platformOp = usePlatformTx(network, txHash, isConvert || isWarpOp || isCreateChain || notFound);

  // Reward payouts are minted directly into P-Chain state, not as tx
  // outputs. The indexer bridges them into emittedUtxos
  // the node fetch remains the amount source here and fallback for pages this flow can't cover.
  const isRewardTx =
    tx?.txType === "RewardValidatorTx" || tx?.txType === "RewardAutoRenewedValidatorTx";
  const isClassicRewardTx = tx?.txType === "RewardValidatorTx";
  const stakingTxId = tx?.details?.stakingTxId;
  const [rewardUtxos, setRewardUtxos] = useState<RewardUtxo[] | null>(null);
  useEffect(() => {
    if (!isRewardTx) return;
    // classic reward UTXOs are minted under the staking tx they reward;
    // Helicon auto-renew payouts are keyed by the reward tx itself
    const key = isClassicRewardTx ? (stakingTxId ?? txHash) : txHash;
    let cancelled = false;
    getRewardUtxos(network, key).then((utxos) => {
      if (!cancelled) setRewardUtxos(utxos);
    });
    return () => {
      cancelled = true;
    };
  }, [isRewardTx, isClassicRewardTx, stakingTxId, network, txHash]);
  const rewardWithdrawn = rewardUtxos?.reduce((sum, u) => sum + u.amount, 0) ?? 0;

  // the compound ratio, for the label on the restaked row
  const [compoundShares, setCompoundShares] = useState<number | null>(null);
  useEffect(() => {
    if (tx?.txType !== "RewardAutoRenewedValidatorTx" || !stakingTxId) return;
    let cancelled = false;
    fetch(`/api/pchain/${network}/tx/${stakingTxId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((staker: Tx | null) => {
        if (!cancelled && typeof staker?.autoCompoundRewardShares === "number") {
          setCompoundShares(staker.autoCompoundRewardShares);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tx?.txType, stakingTxId, network]);

  const rewardRestaked =
    tx?.restakedAmount !== undefined && Number.isFinite(Number(tx.restakedAmount))
      ? Number(tx.restakedAmount)
      : null;

  // a live continuous validator carries its compounded stake in the
  // current validator set: weight minus the original stake is every
  // renewal's restake to date
  const isContinuousStaker = tx?.txType === "AddAutoRenewedValidatorTx";
  const [liveWeight, setLiveWeight] = useState<number | null>(null);
  useEffect(() => {
    if (!isContinuousStaker || !tx?.nodeId) return;
    let cancelled = false;
    getCurrentValidators(network, PRIMARY_SUBNET_ID, [tx.nodeId]).then((validators) => {
      if (cancelled || !validators?.length) return;
      const weight = Number(validators[0].weight);
      if (Number.isFinite(weight) && weight > 0) setLiveWeight(weight);
    });
    return () => {
      cancelled = true;
    };
  }, [isContinuousStaker, network, tx?.nodeId]);
  // an IncreaseL1ValidatorBalanceTx / DisableL1ValidatorTx row carries only
  // the validationID — the node resolves it to the seat's nodeID while the
  // validator is still active (removed seats error, and the row stays off)
  const validationId = tx?.details?.validationId;
  const [l1Seat, setL1Seat] = useState<L1ValidatorInfo | null>(null);
  useEffect(() => {
    setL1Seat(null);
    if (!validationId || tx?.nodeId || isWarpOp) return;
    let cancelled = false;
    getL1Validator(network, validationId).then((v) => {
      if (!cancelled) setL1Seat(v);
    });
    return () => {
      cancelled = true;
    };
  }, [validationId, tx?.nodeId, isWarpOp, network]);

  // a classic staking tx's own reward: once the period ends the payout is
  // minted as reward UTXOs keyed by THIS tx; while the stake is live only
  // the node's current validator set knows the potential reward
  const isDelegatorTx =
    tx?.txType === "AddDelegatorTx" || tx?.txType === "AddPermissionlessDelegatorTx";
  const isPrimaryStaker =
    (isDelegatorTx || tx?.txType === "AddValidatorTx" || tx?.txType === "AddPermissionlessValidatorTx") &&
    tx?.subnetId === PRIMARY_SUBNET_ID;
  const stakeEnded = !!tx?.endTimestamp && tx.endTimestamp <= Date.now() / 1000;
  const [stakeRewardUtxos, setStakeRewardUtxos] = useState<RewardUtxo[] | null>(null);
  useEffect(() => {
    setStakeRewardUtxos(null);
    if (!isPrimaryStaker || !stakeEnded) return;
    let cancelled = false;
    getRewardUtxos(network, txHash).then((utxos) => {
      if (!cancelled) setStakeRewardUtxos(utxos);
    });
    return () => {
      cancelled = true;
    };
  }, [isPrimaryStaker, stakeEnded, network, txHash]);
  const stakeRewardPaid = stakeRewardUtxos?.reduce((sum, u) => sum + u.amount, 0) ?? 0;

  // a delegation's payout mints two reward UTXOs: the delegator's NET reward
  // (owned by the tx's reward addresses) and the validator's delegation-fee cut
  // split by owner so the page can answer "what did I actually get, net of fee".
  const rewardAddrSet = new Set((tx?.rewardAddresses ?? []).map((a) => a.replace(/^P-/, "")));
  const stakeRewardNet =
    isDelegatorTx && stakeRewardUtxos?.length && rewardAddrSet.size
      ? stakeRewardUtxos
          .filter((u) => u.addresses.some((a) => rewardAddrSet.has(a.replace(/^P-/, ""))))
          .reduce((sum, u) => sum + u.amount, 0)
      : null;
  const stakeRewardFee =
    stakeRewardNet !== null && stakeRewardNet > 0 && stakeRewardNet < stakeRewardPaid
      ? stakeRewardPaid - stakeRewardNet
      : null;

  const [potentialReward, setPotentialReward] = useState<number | null>(null);
  // validator's fee percentage — turns the delegator's GROSS potential
  // reward into the net estimate they'll actually receive
  const [validatorFeePct, setValidatorFeePct] = useState<number | null>(null);
  useEffect(() => {
    setPotentialReward(null);
    setValidatorFeePct(null);
    if (!isPrimaryStaker || stakeEnded || !tx?.nodeId) return;
    let cancelled = false;
    getCurrentValidators(network, PRIMARY_SUBNET_ID, [tx.nodeId]).then((validators) => {
      if (cancelled) return;
      const v = validators?.[0];
      if (!v) return;
      const raw = isDelegatorTx
        ? v.delegators?.find((d) => d.txID === txHash)?.potentialReward
        : v.txID === txHash
          ? v.potentialReward
          : undefined;
      const n = raw !== undefined ? Number(raw) : NaN;
      if (Number.isFinite(n) && n > 0) setPotentialReward(n);
      const fee = v.delegationFee !== undefined ? Number(v.delegationFee) : NaN;
      if (isDelegatorTx && Number.isFinite(fee) && fee >= 0 && fee <= 100) setValidatorFeePct(fee);
    });
    return () => {
      cancelled = true;
    };
  }, [isPrimaryStaker, stakeEnded, isDelegatorTx, network, txHash, tx?.nodeId]);

  const initialStake = tx?.amountStaked?.reduce((sum, a) => sum + Number(a.amount || 0), 0) ?? 0;
  const restakedToDate =
    liveWeight !== null && initialStake > 0 && liveWeight > initialStake ? liveWeight - initialStake : null;

  // reward UTXOs join the fund flow as emitted outputs (the diagram
  // already tones Reward* txs' outputs as rewards)
  const rewardEmitted: Utxo[] =
    tx && rewardUtxos?.length
      ? rewardUtxos.map((u) => ({
          addresses: u.addresses.map((a) => a.replace(/^P-/, "")),
          utxoId: `${tx.txHash}:${u.outputIndex}`,
          txHash: tx.txHash,
          outputIndex: u.outputIndex,
          blockTimestamp: tx.blockTimestamp,
          blockNumber: tx.blockNumber,
          assetId: "",
          asset: {
            assetId: "",
            name: "Avalanche",
            symbol: "AVAX",
            denomination: 9,
            amount: String(u.amount),
          },
          utxoType: "reward",
          amount: String(u.amount),
          platformLocktime: u.locktime,
          threshold: u.threshold,
          createdOnChainId: "",
          consumedOnChainId: "",
          staked: false,
        }))
      : [];
  // The indexer serves payout UTXOs in emittedUtxos directly (2026-08-03:
  // classic reward txs too, parented to the staking tx with canonical
  // indices). When the API returns ANY emitted UTXOs they are authoritative;
  // the node fetch remains only as a fallback for un-reindexed history.
  // (Per-key dedupe can't work here: API and node encode different parents
  // for the same classic payout.)
  const flowEmitted = tx
    ? tx.emittedUtxos.length
      ? tx.emittedUtxos
      : rewardEmitted
    : [];

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
          {/* headline hero, full-width above both rails */}
          <section className="flex flex-col gap-4">
            <SectionHeader label="Transaction" action={<TxTypePill type={tx.txType} />} />
            <SubjectHeadline value={tx.txHash} copyLabel="Copy transaction hash" />
          </section>

          {/* identity on the left, type-specific context on the right;
              the fund flow runs full-width below both rails */}
          <div className={hasContext ? "grid items-start gap-x-8 gap-y-10 lg:grid-cols-2" : "flex flex-col gap-10"}>
          <div className="flex flex-col gap-10">
          {/* Overview */}
          <section className="flex flex-col gap-4">
            <SectionHeader label="Overview" />
            <Board divide={false} className="px-5 py-4 md:px-6">
              <SpecPlate>
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
                {/* the stake's own payout once it ended, the live potential
                    reward until then, the indexer's estimate as fallback */}
                {stakeRewardUtxos !== null ? (
                  stakeRewardUtxos.length === 0 ? (
                    <SpecRow label="Reward">
                      {/* the chain records only the commit/abort vote. on the primary network
                          the vote's sole input is the validator's observed uptime vs the 80% requirement. */}
                      None (aborted)
                      <span className="mt-0.5 block font-mono text-[10.5px] leading-relaxed text-zinc-400 dark:text-zinc-500">
                        validator missed the 80% uptime vote at settlement — principal returned, reward forfeited
                      </span>
                    </SpecRow>
                  ) : stakeRewardNet !== null && stakeRewardFee !== null ? (
                    /* delegation payout split by UTXO owner: what the
                       delegator actually received vs the validator's cut */
                    <>
                      <SpecRow label="Reward Received">
                        {formatAvax(stakeRewardNet)}
                        <span className="ml-2 text-zinc-400 dark:text-zinc-500">
                          net of delegation fee
                        </span>
                      </SpecRow>
                      <SpecRow label="Delegation Fee">
                        {formatAvax(stakeRewardFee)}
                        <span className="ml-2 text-zinc-400 dark:text-zinc-500">
                          paid to the validator
                        </span>
                      </SpecRow>
                    </>
                  ) : (
                    <SpecRow label="Reward">{formatAvax(stakeRewardPaid)}</SpecRow>
                  )
                ) : potentialReward !== null ? (
                  <SpecRow label="Est. Reward">
                    {validatorFeePct !== null && potentialReward > 0 ? (
                      <>
                        {formatAvax(Math.round(potentialReward * (1 - validatorFeePct / 100)))}
                        <span className="ml-2 text-zinc-400 dark:text-zinc-500">
                          net of {validatorFeePct}% delegation fee
                        </span>
                      </>
                    ) : (
                      formatAvax(potentialReward)
                    )}
                  </SpecRow>
                ) : tx.estimatedReward ? (
                  <SpecRow label="Est. Reward">{formatAvax(tx.estimatedReward)}</SpecRow>
                ) : null}
                {/* A continuous validator's reward never commits/aborts:
                    each renewal restakes the compound share and mints the
                    rest straight into state (shown in the fund flow). The
                    indexer's rewardPaid flag only means something for the
                    legacy end-of-stake commit/abort vote. */}
                {tx.details?.rewardPaid !== undefined &&
                  (tx.txType === "RewardAutoRenewedValidatorTx" ? (
                    rewardUtxos === null ? (
                      <SpecRow label="Reward">Restaked · compounds into the stake</SpecRow>
                    ) : rewardUtxos.length === 0 ? (
                      <SpecRow label="Reward">Fully compounded into the stake</SpecRow>
                    ) : rewardRestaked !== null ? (
                      /* known compound ratio → break the cycle reward into
                         its two destinations on separate lines */
                      <>
                        <SpecRow label="Cycle Reward">
                          {formatAvax(rewardRestaked + rewardWithdrawn)}
                        </SpecRow>
                        <SpecRow label="Restaked">
                          {formatAvax(rewardRestaked)}
                          <span className="ml-2 text-zinc-400 dark:text-zinc-500">
                            {compoundShares !== null
                              ? `${(compoundShares / 10_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}% auto-compounded into the stake`
                              : "compounded into the stake"}
                          </span>
                        </SpecRow>
                        <SpecRow label="Withdrawn">
                          {formatAvax(rewardWithdrawn)}
                          <span className="ml-2 text-zinc-400 dark:text-zinc-500">
                            paid out to the reward owner
                          </span>
                        </SpecRow>
                      </>
                    ) : (
                      <SpecRow label="Withdrawn">
                        {formatAvax(rewardWithdrawn)}
                        <span className="ml-2 text-zinc-400 dark:text-zinc-500">
                          plus a restaked share (not yet resolved)
                        </span>
                      </SpecRow>
                    )
                  ) : (
                    <SpecRow label="Reward Paid">
                      {tx.details.rewardPaid ? "Yes (committed)" : "No (aborted)"}
                      {!tx.details.rewardPaid && (
                        <span className="mt-0.5 block font-mono text-[10.5px] leading-relaxed text-zinc-400 dark:text-zinc-500">
                        validator missed the 80% uptime vote at settlement — principal returned, reward forfeited
                      </span>
                      )}
                    </SpecRow>
                  ))}
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

          {/* Continuous staking (Helicon auto-renew family) */}
          {hasContinuous && (
            <Section label="Continuous Staking">
              <SpecPlate>
                {tx.period !== undefined &&
                  (tx.period > 0 ? (
                    <SpecRow label="Renews Every">
                      {tx.periodHuman ?? humanPeriod(tx.period)}
                      <span className="ml-2 text-zinc-400 dark:text-zinc-500">
                        {tx.period.toLocaleString("en-US")}s
                      </span>
                    </SpecRow>
                  ) : (
                    /* period=0 is the graceful exit: stop auto-renewing */
                    <SpecRow label="Renews Every">
                      Does not renew
                      <span className="ml-2 text-zinc-400 dark:text-zinc-500">
                        graceful exit — the stake ends after the current period
                      </span>
                    </SpecRow>
                  ))}
                {autoCompoundPct(tx) !== null && (
                  <SpecRow label="Auto-Compound">
                    {autoCompoundPct(tx) === "0"
                      ? "0% — rewards are fully paid out, nothing restakes"
                      : `${autoCompoundPct(tx)}% of each reward restakes`}
                  </SpecRow>
                )}
                {/* compounding shows up as stake weight: the live set's
                    weight above the original stake is every renewal's
                    restake so far (only visible while the validator is
                    in the current set) */}
                {liveWeight !== null && (
                  <SpecRow label="Current Stake">{formatAvax(liveWeight)}</SpecRow>
                )}
                {restakedToDate !== null && (
                  <SpecRow label="Restaked To Date">{formatAvax(restakedToDate)}</SpecRow>
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
                {l1Seat?.nodeID && (
                  <SpecRow label="Node ID">
                    <HashChip value={l1Seat.nodeID} href={`${base}/node/${l1Seat.nodeID}`} len={32} />
                  </SpecRow>
                )}
                {l1Seat?.subnetID && !tx.subnetId && (
                  <SpecRow label="Subnet ID">
                    <SubnetChip base={base} subnetId={l1Seat.subnetID} />
                  </SpecRow>
                )}
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

          {/* CreateChainTx: the full genesis document, decoded from the
              node's copy of the tx — overview + raw JSON, full-width */}
          {isCreateChain && (platformOp.loading || platformOp.data?.genesisData != null) && (
            <GenesisViewer genesisData={platformOp.data?.genesisData} loading={platformOp.loading} />
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
              emitted: flowEmitted,
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
                  emitted={flowEmitted}
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
                <UtxoColumn base={base} title={`Emitted · ${flowEmitted.length}`} utxos={flowEmitted} side="out" />
              </div>
            )}
            {rewardEmitted.length > 0 && (
              <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                Reward UTXOs are minted directly into P-Chain state under this transaction&apos;s
                ID rather than as transaction outputs, so they are read from the node, not the
                indexer.
              </p>
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
   node-decoded inputs. Additive — if the RPC is unreachable,
   data stays null and the panels don't render. */
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
                          len={50}
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

export function UtxoColumn({ base, title, utxos, side }: { base: string; title: string; utxos: Utxo[]; side: "in" | "out" }) {
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
                  href={
                    (side === "in" &&
                      chainOfId(u.createdOnChainId) &&
                      crossChainAddressUrl(base.split("/")[2], u.createdOnChainId, a)) ||
                    `${base}/address/${a}`
                  }
                  className="font-mono text-[11px] text-[#0061E2] underline-offset-2 hover:text-[#E6212F] hover:underline dark:text-[#5f9dff]"
                >
                  {truncate(a, 14)}
                </Link>
              ))}
            </div>
            {u.consumingTxHash && side === "out" && (() => {
              // Exported outputs are claimed on ANOTHER chain — the API fills
              // consumedOnChainId with the destination blockchain id, and the
              // link must route to that chain's tx page (C-chain claims are
              // atomic txs with their own detail route).
              const net = base.split("/")[2];
              const cross = chainOfId(u.consumedOnChainId);
              const href =
                (cross && cross !== "P-Chain" && crossChainTxUrl(net, u.consumedOnChainId, u.consumingTxHash)) ||
                `${base}/tx/${u.consumingTxHash}`;
              const verb = cross && cross !== "P-Chain" ? `claimed on ${cross} in` : "spent in";
              return (
                <Link
                  href={href}
                  className="font-mono text-[10px] text-[#0061E2] hover:text-[#E6212F] dark:text-[#5f9dff]"
                >
                  {verb} {truncate(u.consumingTxHash, 12)} →
                </Link>
              );
            })()}
            {/* walk any UTXO backward through delegations/transfers — or, for
                an atomic input, straight to the export on the source chain */}
            {u.txHash && side === "in" && (() => {
              const cross = chainOfId(u.createdOnChainId);
              const net = base.split("/")[2];
              const href =
                (cross && crossChainTxUrl(net, u.createdOnChainId, u.txHash)) || `${base}/tx/${u.txHash}`;
              const verb = cross ? `← exported from ${cross} in` : "← created in";
              return (
                <Link href={href} className="font-mono text-[10px] text-[#0061E2] hover:text-[#E6212F] dark:text-[#5f9dff]">
                  {verb} {truncate(u.txHash, 12)}
                </Link>
              );
            })()}
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
