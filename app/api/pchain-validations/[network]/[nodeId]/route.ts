import { NextResponse } from "next/server";
import { Avalanche } from "@avalanche-sdk/chainkit";
import type { ValidationPeriod, ValidationsResponse } from "@/lib/pchain-explorer";

/* Completed validation periods for a P-Chain node.
 *
 * The explorer's own node document already carries a `history` list, but it is
 * an unfiltered feed of the node's recent staking txs capped at 100 rows
 * upstream (no filter or limit param is honoured). On a popular validator all
 * 100 of those rows are delegator additions, so the node's own past validation
 * periods are pushed clean out of the payload. That is why the rebuilt node
 * page lost the track record the old one showed.
 *
 * The Data API indexes the periods themselves, which is the shape a would-be
 * delegator is actually reading: how long this node has been validating, and
 * whether each term paid out. Note it does NOT retain per-period uptime, only
 * the rewards that were paid. Since a term only pays when the node met the
 * uptime requirement, the payout IS the performance record.
 */

export const dynamic = "force-dynamic";

const FETCH_TIMEOUT_MS = 15_000;
// A period is immutable once the term closes; the only change is a new row
// appearing when the current term ends. Cache hard, revalidate in the
// background, and spare the Data API the repeat traffic.
const CACHE_CONTROL = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";
// Enough to cover the longest-serving mainnet validators (1-year max terms
// since genesis) without paginating.
const PAGE_SIZE = 100;

const NETWORKS = { mainnet: "mainnet", fuji: "fuji" } as const;
type ExplorerNetwork = keyof typeof NETWORKS;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ network: string; nodeId: string }> },
) {
  const { network, nodeId } = await params;

  if (!(network in NETWORKS)) {
    return NextResponse.json({ error: `unknown network '${network}'` }, { status: 404 });
  }
  if (!nodeId.startsWith("NodeID-")) {
    return NextResponse.json({ error: "expected a NodeID-… identifier" }, { status: 400 });
  }

  try {
    const periods = await withTimeout(fetchPeriods(network as ExplorerNetwork, nodeId));
    const body: ValidationsResponse = { nodeId, periods, totals: summarize(periods) };
    return NextResponse.json(body, { headers: { "cache-control": CACHE_CONTROL } });
  } catch (err) {
    const timedOut = err instanceof Error && err.message === "timeout";
    // No cache header on failure: a transient Data API blip must not be
    // pinned at the edge for an hour.
    return NextResponse.json(
      { error: timedOut ? "data API timeout" : "data API unreachable" },
      { status: 504 },
    );
  }
}

async function fetchPeriods(network: ExplorerNetwork, nodeId: string): Promise<ValidationPeriod[]> {
  const avalanche = new Avalanche({ network: NETWORKS[network] });
  const pages = await avalanche.data.primaryNetwork.getValidatorDetails({
    nodeId,
    validationStatus: "completed",
    sortOrder: "desc",
    pageSize: PAGE_SIZE,
  });

  const periods: ValidationPeriod[] = [];
  for await (const page of pages) {
    for (const v of page.result?.validators ?? []) {
      // The union also covers active/pending/removed shapes; only completed
      // ones carry a settled `rewards` object.
      if (!("rewards" in v) || v.validationStatus !== "completed") continue;
      const validationReward = v.rewards?.validationRewardAmount ?? "0";
      periods.push({
        txHash: v.txHash,
        startTimestamp: v.startTimestamp,
        endTimestamp: v.endTimestamp,
        amountStaked: v.amountStaked,
        delegationFeePercent: Number(v.delegationFee ?? 0),
        delegatorCount: v.delegatorCount,
        amountDelegated: v.amountDelegated ?? "0",
        validationReward,
        delegationReward: v.rewards?.delegationRewardAmount ?? "0",
        rewardTxHash: v.rewards?.rewardTxHash,
        rewarded: toBig(validationReward) > 0n,
      });
    }
    // One page is the whole record for every real validator; bail rather than
    // walking the iterator into more Data API calls we have no use for.
    break;
  }
  return periods;
}

function summarize(periods: ValidationPeriod[]): ValidationsResponse["totals"] {
  // nAVAX totals over a multi-year validator exceed what a double holds
  // exactly, so sum in BigInt and hand the caller strings.
  let validation = 0n;
  let delegation = 0n;
  for (const p of periods) {
    validation += toBig(p.validationReward);
    delegation += toBig(p.delegationReward);
  }
  return {
    periods: periods.length,
    validationReward: validation.toString(),
    delegationReward: delegation.toString(),
    firstStart: periods.length ? Math.min(...periods.map((p) => p.startTimestamp)) : null,
    unrewarded: periods.filter((p) => !p.rewarded).length,
  };
}

/** Data API amounts are decimal strings, but treat a malformed one as zero
 *  rather than letting BigInt() throw the whole response away. */
function toBig(v: string | undefined): bigint {
  if (!v || !/^\d+$/.test(v)) return 0n;
  return BigInt(v);
}

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), FETCH_TIMEOUT_MS)),
  ]);
}
