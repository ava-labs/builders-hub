"use client";

import { useEffect, useState } from "react";
import {
  PRIMARY_SUBNET_ID,
  getCurrentValidators,
  getL1Validator,
  getPlatformTx,
  getRewardUtxos,
  type L1ValidatorInfo,
  type PlatformUnsignedTx,
  type RewardUtxo,
} from "@/lib/pchain-node";
import type { Tx, Utxo } from "@/lib/pchain-explorer";

/* What a tx page reads beyond the indexer's record: the node's decoded
   copy of a platform op, the reward UTXOs minted into state, and the live
   validator set for a stake still running. Each read fills in after the
   page paints, and a failed read leaves its line out. */

/** which kind of tx this is, for the reads and the sections */
export function txKind(tx: Tx | null) {
  const type = tx?.txType;
  const isDelegator = type === "AddDelegatorTx" || type === "AddPermissionlessDelegatorTx";
  return {
    isConvert: type === "ConvertSubnetToL1Tx",
    isCreateChain: type === "CreateChainTx",
    isWarpOp: type === "RegisterL1ValidatorTx" || type === "SetL1ValidatorWeightTx",
    isReward: type === "RewardValidatorTx" || type === "RewardAutoRenewedValidatorTx",
    isClassicReward: type === "RewardValidatorTx",
    isDelegator,
    isPrimaryStaker:
      (isDelegator || type === "AddValidatorTx" || type === "AddPermissionlessValidatorTx") && tx?.subnetId === PRIMARY_SUBNET_ID,
  };
}

/* One platform.getTx read per page, shared by every panel that needs the
   node-decoded inputs. Additive: if the RPC is unreachable, data stays
   null and the panels do not render. */
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

/** one async read keyed by its inputs; null until it lands, and again when the key changes */
function useRead<T>(key: string | null, read: () => Promise<T | null>): T | null {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    setValue(null);
    if (key === null) return;
    let cancelled = false;
    read().then((v) => {
      if (!cancelled) setValue(v);
    });
    return () => {
      cancelled = true;
    };
    // the key names everything the read depends on
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return value;
}

const sumOf = (us: RewardUtxo[] | null) => us?.reduce((s, u) => s + u.amount, 0) ?? 0;

export function useTxContext(network: string, txHash: string, tx: Tx | null, notFound: boolean) {
  const k = txKind(tx);
  // on a 404 the node's copy doubles as the "is it on-chain at all" check
  const platformOp = usePlatformTx(network, txHash, k.isConvert || k.isWarpOp || k.isCreateChain || notFound);

  // reward payouts are minted into P-Chain state, not as tx outputs: classic
  // reward UTXOs sit under the staking tx they reward, auto-renew payouts
  // under the reward tx itself
  const stakingTxId = tx?.details?.stakingTxId;
  const rewardKey = k.isReward ? (k.isClassicReward ? (stakingTxId ?? txHash) : txHash) : null;
  const rewardUtxos = useRead(rewardKey && `${network}|${rewardKey}`, () => getRewardUtxos(network, rewardKey!));

  // the compound ratio, for the restaked row
  const compoundShares = useRead(
    tx?.txType === "RewardAutoRenewedValidatorTx" && stakingTxId ? `${network}|${stakingTxId}` : null,
    () =>
      fetch(`/api/pchain/${network}/tx/${stakingTxId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((staker: Tx | null) => (typeof staker?.autoCompoundRewardShares === "number" ? staker.autoCompoundRewardShares : null))
        .catch(() => null),
  );

  // a live continuous validator's weight above its first stake is every renewal's restake so far
  const liveWeight = useRead(tx?.txType === "AddAutoRenewedValidatorTx" && tx.nodeId ? `${network}|${tx.nodeId}` : null, () =>
    getCurrentValidators(network, PRIMARY_SUBNET_ID, [tx!.nodeId!]).then((vs) => {
      const w = Number(vs?.[0]?.weight);
      return Number.isFinite(w) && w > 0 ? w : null;
    }),
  );

  // a balance or disable row carries only the validationID: the node names
  // the seat's node while the seat is active (removed seats error)
  const validationId = tx?.details?.validationId;
  const l1Seat = useRead<L1ValidatorInfo>(validationId && !tx?.nodeId && !k.isWarpOp ? `${network}|${validationId}` : null, () =>
    getL1Validator(network, validationId!),
  );

  // a classic stake's own reward: minted under this tx once the period ends;
  // until then only the live validator set knows the potential reward
  const stakeEnded = !!tx?.endTimestamp && tx.endTimestamp <= Date.now() / 1000;
  const stakeRewardUtxos = useRead(k.isPrimaryStaker && stakeEnded ? `${network}|${txHash}` : null, () => getRewardUtxos(network, txHash));
  const live = useRead(k.isPrimaryStaker && !stakeEnded && tx?.nodeId ? `${network}|${txHash}|${tx.nodeId}` : null, () =>
    getCurrentValidators(network, PRIMARY_SUBNET_ID, [tx!.nodeId!]).then((validators) => {
      const v = validators?.[0];
      if (!v) return null;
      const raw = k.isDelegator ? v.delegators?.find((d) => d.txID === txHash)?.potentialReward : v.txID === txHash ? v.potentialReward : undefined;
      const reward = raw !== undefined ? Number(raw) : NaN;
      const fee = v.delegationFee !== undefined ? Number(v.delegationFee) : NaN;
      return {
        potentialReward: Number.isFinite(reward) && reward > 0 ? reward : null,
        // the validator's cut turns a delegator's gross reward into the net it receives
        validatorFeePct: k.isDelegator && Number.isFinite(fee) && fee >= 0 && fee <= 100 ? fee : null,
      };
    }),
  );

  // a delegation's payout mints two reward UTXOs: the delegator's net reward
  // (owned by the tx's reward addresses) and the validator's fee
  const stakeRewardPaid = sumOf(stakeRewardUtxos);
  const rewardAddrs = new Set((tx?.rewardAddresses ?? []).map((a) => a.replace(/^P-/, "")));
  const stakeRewardNet =
    k.isDelegator && stakeRewardUtxos?.length && rewardAddrs.size
      ? sumOf(stakeRewardUtxos.filter((u) => u.addresses.some((a) => rewardAddrs.has(a.replace(/^P-/, "")))))
      : null;
  const stakeRewardFee = stakeRewardNet !== null && stakeRewardNet > 0 && stakeRewardNet < stakeRewardPaid ? stakeRewardPaid - stakeRewardNet : null;

  const initialStake = tx?.amountStaked?.reduce((sum, a) => sum + Number(a.amount || 0), 0) ?? 0;
  const restakedToDate = liveWeight !== null && initialStake > 0 && liveWeight > initialStake ? liveWeight - initialStake : null;
  const rewardRestaked = tx?.restakedAmount !== undefined && Number.isFinite(Number(tx.restakedAmount)) ? Number(tx.restakedAmount) : null;

  // The indexer serves payout UTXOs in emittedUtxos (classic reward txs
  // too, parented to the staking tx). When it returns any they are
  // authoritative; the node's reward UTXOs are the fallback for history
  // the indexer has not reread. (API and node encode different parents for
  // the same classic payout, so the two cannot be merged per key.)
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
          asset: { assetId: "", name: "Avalanche", symbol: "AVAX", denomination: 9, amount: String(u.amount) },
          utxoType: "reward",
          amount: String(u.amount),
          platformLocktime: u.locktime,
          threshold: u.threshold,
          createdOnChainId: "",
          consumedOnChainId: "",
          staked: false,
        }))
      : [];
  const flowEmitted = tx ? (tx.emittedUtxos.length ? tx.emittedUtxos : rewardEmitted) : [];

  return {
    ...k,
    platformOp,
    rewardUtxos,
    rewardWithdrawn: sumOf(rewardUtxos),
    rewardRestaked,
    compoundShares,
    liveWeight,
    restakedToDate,
    l1Seat,
    stakeRewardUtxos,
    stakeRewardPaid,
    stakeRewardNet,
    stakeRewardFee,
    potentialReward: live?.potentialReward ?? null,
    validatorFeePct: live?.validatorFeePct ?? null,
    /** the node's reward UTXOs stand in for outputs the indexer has not read */
    fromNode: tx ? tx.emittedUtxos.length === 0 && rewardEmitted.length > 0 : false,
    flowEmitted,
  };
}

export type TxContext = ReturnType<typeof useTxContext>;

/* fallback when the API sends only raw seconds: the largest unit that
   divides the period evenly, as the API's periodHuman does */
export function humanPeriod(secs: number): string {
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

/* the auto-compound share of each reward, whichever encoding the API
   sent: a percent, or raw shares in parts per million (1,000,000 = 100%) */
export function autoCompoundPct(tx: Tx): string | null {
  const pct = tx.autoCompoundPercent ?? (tx.autoCompoundRewardShares !== undefined ? tx.autoCompoundRewardShares / 10_000 : undefined);
  if (pct === undefined) return null;
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(2);
}
