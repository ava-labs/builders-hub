"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Board, HashChip, SectionHeader, SpecLine, SpecSheet, HEAD, ROW, INK, MUTED, CellLabel } from "@/components/explorer-v2/ui";
import { formatAvax, formatTime, timeAgo, truncate } from "@/components/explorer-v2/format";
import {
  PRIMARY_SUBNET_ID,
  bytesToHex,
  decodeL1WarpMessage,
  hexToNodeId,
  type DecodedL1WarpMessage,
  type L1InitialValidator,
  type PlatformUnsignedTx,
} from "@/lib/pchain-node";
import { knownChainName, type Tx } from "@/lib/pchain-explorer";
import { autoCompoundPct, humanPeriod, type TxContext } from "./tx-hooks";

/* The tx type's own record, one sheet per concern: the stake, its
   renewal, the L1 seat, the subnet or chain it made, the cross-chain
   move, the conversion and the signed Warp message. Each sheet sets its
   identifiers whole, label column then value, the way every detail page
   does. */

const NOTE = "ml-3 font-normal text-zinc-400 dark:text-zinc-500";

export function Sheet({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-4">
      <SectionHeader label={label} action={action} />
      <Board divide={false} className="px-5 md:px-6">
        <SpecSheet>{children}</SpecSheet>
      </Board>
    </section>
  );
}

function Bones() {
  return (
    <div className="flex flex-col gap-3 py-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-3 w-2/3 animate-pulse bg-zinc-100 dark:bg-zinc-900" />
      ))}
    </div>
  );
}

/* Subnet IDs are CreateSubnetTx IDs, so they link to the tx that made them,
   except the Primary Network's, which genesis made. */
export function SubnetChip({ base, subnetId }: { base: string; subnetId: string }) {
  return <HashChip value={subnetId} href={subnetId !== PRIMARY_SUBNET_ID ? `${base}/tx/${subnetId}` : undefined} len={66} />;
}

/* a cross-chain end: a known chain by its name, else its whole ID */
function ChainCell({ id, name }: { id: string; name?: string }) {
  const label = name ?? knownChainName(id);
  if (!label) return <HashChip value={id} len={66} />;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-1 bg-[#0c7590] dark:bg-[#3fc1dc]" aria-hidden />
      {label}
    </span>
  );
}

/* a blockchain reference: the C-Chain hands off to its explorer, a known
   chain says its name, any other links to its P-Chain chain page */
function ChainRef({ id, base }: { id: string; base: string }) {
  const known = knownChainName(id);
  if (known === "C-Chain") {
    return (
      <span className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <ChainCell id={id} />
        <Link href="/explorer/mainnet/c-chain" className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-[#E6212F] dark:text-zinc-500">
          Explorer →
        </Link>
      </span>
    );
  }
  if (known) return <ChainCell id={id} />;
  return <HashChip value={id} href={`${base}/chain/${id}`} len={66} />;
}

function AddrList({ base, addrs }: { base: string; addrs: string[] }) {
  return (
    <span className="flex flex-col gap-1">
      {addrs.map((a) => (
        <HashChip key={a} value={a} href={`${base}/address/${a.replace(/^P-/, "")}`} len={66} />
      ))}
    </span>
  );
}

function OwnerCell({ base, owner }: { base: string; owner: { threshold: number; addresses: string[] } }) {
  return (
    <span className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
        {owner.threshold} of {owner.addresses.length} to sign
      </span>
      <AddrList base={base} addrs={owner.addresses} />
    </span>
  );
}

/* the uptime line of a stake the chain did not reward */
function Forfeit({ uptimeReq }: { uptimeReq: number | null }) {
  return (
    <span className="mt-0.5 block font-sans text-[13px] font-normal text-zinc-500 dark:text-zinc-400">
      uptime was {uptimeReq !== null ? `under ${uptimeReq}%` : "too low"} at the stake&apos;s end: the stake came back, the reward did not
    </span>
  );
}

export function StakingSheet({ tx, ctx, base, uptimeReq, bls }: { tx: Tx; ctx: TxContext; base: string; uptimeReq: number | null; bls?: string }) {
  const d = tx.details;
  const reward = (() => {
    // the stake's own payout once it ended, the live potential reward until then, the indexer's estimate last
    if (ctx.stakeRewardUtxos !== null) {
      if (ctx.stakeRewardUtxos.length === 0)
        return (
          <SpecLine label="Reward">
            None (aborted)
            <Forfeit uptimeReq={uptimeReq} />
          </SpecLine>
        );
      if (ctx.stakeRewardNet !== null && ctx.stakeRewardFee !== null)
        return (
          <>
            <SpecLine label="Reward Received">
              {formatAvax(ctx.stakeRewardNet)}
              <span className={NOTE}>net of the delegation fee</span>
            </SpecLine>
            <SpecLine label="Delegation Fee Paid">
              {formatAvax(ctx.stakeRewardFee)}
              <span className={NOTE}>to the validator</span>
            </SpecLine>
          </>
        );
      return <SpecLine label="Reward">{formatAvax(ctx.stakeRewardPaid)}</SpecLine>;
    }
    if (ctx.potentialReward !== null)
      return (
        <SpecLine label="Est. Reward">
          {ctx.validatorFeePct !== null ? (
            <>
              {formatAvax(Math.round(ctx.potentialReward * (1 - ctx.validatorFeePct / 100)))}
              <span className={NOTE}>net of the {ctx.validatorFeePct}% delegation fee</span>
            </>
          ) : (
            formatAvax(ctx.potentialReward)
          )}
        </SpecLine>
      );
    return tx.estimatedReward ? <SpecLine label="Est. Reward">{formatAvax(tx.estimatedReward)}</SpecLine> : null;
  })();

  // A continuous validator's reward never commits or aborts: each renewal
  // restakes the compound share and mints the rest into state. The
  // indexer's rewardPaid only means something for the classic end-of-stake vote.
  const paid =
    d?.rewardPaid === undefined ? null : tx.txType === "RewardAutoRenewedValidatorTx" ? (
      ctx.rewardUtxos === null ? (
        <SpecLine label="Reward">Restaked: compounds into the stake</SpecLine>
      ) : ctx.rewardUtxos.length === 0 ? (
        <SpecLine label="Reward">Fully compounded into the stake</SpecLine>
      ) : ctx.rewardRestaked !== null ? (
        <>
          <SpecLine label="Cycle Reward">{formatAvax(ctx.rewardRestaked + ctx.rewardWithdrawn)}</SpecLine>
          <SpecLine label="Restaked">
            {formatAvax(ctx.rewardRestaked)}
            <span className={NOTE}>
              {ctx.compoundShares !== null
                ? `${(ctx.compoundShares / 10_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}% auto-compounded into the stake`
                : "compounded into the stake"}
            </span>
          </SpecLine>
          <SpecLine label="Withdrawn">
            {formatAvax(ctx.rewardWithdrawn)}
            <span className={NOTE}>paid out to the reward owner</span>
          </SpecLine>
        </>
      ) : (
        <SpecLine label="Withdrawn">
          {formatAvax(ctx.rewardWithdrawn)}
          <span className={NOTE}>plus a restaked share the node does not report</span>
        </SpecLine>
      )
    ) : (
      <SpecLine label="Reward Paid">
        {d.rewardPaid ? "Yes (committed)" : "No (aborted)"}
        {!d.rewardPaid && <Forfeit uptimeReq={uptimeReq} />}
      </SpecLine>
    );

  return (
    <Sheet label="Staking">
      {tx.nodeId && (
        <SpecLine label="Node ID">
          <HashChip value={tx.nodeId} href={`${base}/node/${tx.nodeId}`} len={66} />
        </SpecLine>
      )}
      {tx.subnetId && (
        <SpecLine label="Subnet ID">
          <SubnetChip base={base} subnetId={tx.subnetId} />
        </SpecLine>
      )}
      {/* a subnet validator's weight is a plain number, only the Primary Network stakes AVAX */}
      {d?.weight !== undefined &&
        (tx.subnetId && tx.subnetId !== PRIMARY_SUBNET_ID ? (
          <SpecLine label="Weight">{d.weight.toLocaleString("en-US")}</SpecLine>
        ) : (
          <SpecLine label="Weight / Stake">{formatAvax(d.weight)}</SpecLine>
        ))}
      {d?.delegationFeePercent !== undefined && <SpecLine label="Delegation Fee">{d.delegationFeePercent}%</SpecLine>}
      {tx.startTimestamp !== undefined && tx.startTimestamp > 0 && <SpecLine label="Start">{formatTime(tx.startTimestamp)}</SpecLine>}
      {tx.endTimestamp !== undefined && tx.endTimestamp > 0 && <SpecLine label="End">{formatTime(tx.endTimestamp)}</SpecLine>}
      {reward}
      {paid}
      {d?.stakingTxId && (
        <SpecLine label="Staking Tx">
          <HashChip value={d.stakingTxId} href={`${base}/tx/${d.stakingTxId}`} len={66} />
        </SpecLine>
      )}
      {tx.rewardAddresses?.length ? (
        <SpecLine label="Reward Owners" align="start">
          <AddrList base={base} addrs={tx.rewardAddresses} />
        </SpecLine>
      ) : null}
      {bls && (
        <SpecLine label="BLS Public Key">
          <HashChip value={bls} len={120} />
        </SpecLine>
      )}
    </Sheet>
  );
}

export function ContinuousSheet({ tx, ctx, base }: { tx: Tx; ctx: TxContext; base: string }) {
  const pct = autoCompoundPct(tx);
  return (
    <Sheet label="Continuous Staking">
      {tx.period !== undefined &&
        (tx.period > 0 ? (
          <SpecLine label="Renews Every">
            {tx.periodHuman ?? humanPeriod(tx.period)}
            <span className={NOTE}>{tx.period.toLocaleString("en-US")}s</span>
          </SpecLine>
        ) : (
          // a period of 0 is the graceful exit: the stake stops renewing
          <SpecLine label="Renews Every">
            Does not renew
            <span className={NOTE}>the stake ends after its current period</span>
          </SpecLine>
        ))}
      {pct !== null && (
        <SpecLine label="Auto-Compound">{pct === "0" ? "0%: every reward is paid out, none restakes" : `${pct}% of each reward restakes`}</SpecLine>
      )}
      {/* compounding shows up as weight: the live set's weight above the first
          stake is every renewal's restake so far, while the validator is in the set */}
      {ctx.liveWeight !== null && <SpecLine label="Current Stake">{formatAvax(ctx.liveWeight)}</SpecLine>}
      {ctx.restakedToDate !== null && <SpecLine label="Restaked To Date">{formatAvax(ctx.restakedToDate)}</SpecLine>}
      {tx.validatorAuthority?.length ? (
        <SpecLine label="Config Authority" align="start">
          <AddrList base={base} addrs={tx.validatorAuthority} />
        </SpecLine>
      ) : null}
    </Sheet>
  );
}

export function L1ValidationSheet({ tx, ctx, base }: { tx: Tx; ctx: TxContext; base: string }) {
  const d = tx.details;
  return (
    <Sheet label="L1 Validation">
      {ctx.l1Seat?.nodeID && (
        <SpecLine label="Node ID">
          <HashChip value={ctx.l1Seat.nodeID} href={`${base}/node/${ctx.l1Seat.nodeID}`} len={66} />
        </SpecLine>
      )}
      {ctx.l1Seat?.subnetID && !tx.subnetId && (
        <SpecLine label="Subnet ID">
          <SubnetChip base={base} subnetId={ctx.l1Seat.subnetID} />
        </SpecLine>
      )}
      {d?.validationId && (
        <SpecLine label="Validation ID">
          <HashChip value={d.validationId} len={66} />
        </SpecLine>
      )}
      {d?.l1Balance !== undefined && <SpecLine label="L1 Balance">{formatAvax(d.l1Balance)}</SpecLine>}
      {d?.blsPublicKey && (
        <SpecLine label="BLS Public Key">
          <HashChip value={d.blsPublicKey} len={120} />
        </SpecLine>
      )}
    </Sheet>
  );
}

export function CreationSheet({ tx, base }: { tx: Tx; base: string }) {
  const d = tx.details;
  return (
    <Sheet label="Subnet / Chain">
      {d?.chainName && <SpecLine label="Chain Name">{d.chainName}</SpecLine>}
      {tx.subnetId && tx.txType !== "CreateSubnetTx" && (
        <SpecLine label="Subnet ID">
          <SubnetChip base={base} subnetId={tx.subnetId} />
        </SpecLine>
      )}
      {d?.vmId && (
        <SpecLine label="VM ID">
          <HashChip value={d.vmId} len={66} />
        </SpecLine>
      )}
      {d?.genesisDataHash && (
        <SpecLine label="Genesis Hash">
          <HashChip value={d.genesisDataHash} len={66} />
        </SpecLine>
      )}
      {d?.subnetThreshold !== undefined && <SpecLine label="Threshold">{d.subnetThreshold}</SpecLine>}
      {d?.subnetOwners?.length ? (
        <SpecLine label="Subnet Owners" align="start">
          <AddrList base={base} addrs={d.subnetOwners} />
        </SpecLine>
      ) : null}
    </Sheet>
  );
}

export function CrossChainSheet({ tx }: { tx: Tx }) {
  const d = tx.details;
  return (
    <Sheet label="Cross-Chain">
      {d?.sourceChain && (
        <SpecLine label="Source Chain">
          <ChainCell id={d.sourceChain} name={tx.importedFrom?.chainName} />
        </SpecLine>
      )}
      {d?.destinationChain && (
        <SpecLine label="Destination Chain">
          <ChainCell id={d.destinationChain} />
        </SpecLine>
      )}
      {tx.importedFrom?.exports?.map((exp, i) => (
        <Fragment key={exp.txHash || i}>
          {exp.amount && <SpecLine label="Imported Amount">{formatAvax(exp.amount)}</SpecLine>}
          {exp.evmSenders?.map((a) => (
            <SpecLine key={a} label="Funder Address">
              <HashChip value={a} len={66} />
            </SpecLine>
          ))}
          <SpecLine label="Transaction Hash">
            <HashChip value={exp.txHash} len={66} />
          </SpecLine>
        </Fragment>
      ))}
    </Sheet>
  );
}

/* ConvertSubnetToL1Tx: the manager pointers the node decodes. The manager
   chain's page carries what the conversion made: the live set, the
   ownership and the manager contract. chainID is a CreateChainTx ID,
   which /chain/ keys on. */
export function ConversionSheet({ u, loading, subnetId, base }: { u: PlatformUnsignedTx | null; loading: boolean; subnetId?: string; base: string }) {
  return (
    <Sheet
      label="L1 Conversion"
      action={
        u?.chainID ? (
          <Link href={`${base}/chain/${u.chainID}`} className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:text-[#E6212F] dark:text-zinc-500">
            View L1 details →
          </Link>
        ) : undefined
      }
    >
      {loading || !u ? (
        <Bones />
      ) : (
        <>
          {subnetId && (
            <SpecLine label="Subnet Converted">
              <SubnetChip base={base} subnetId={subnetId} />
            </SpecLine>
          )}
          {u.chainID && (
            <SpecLine label="Manager Chain">
              <ChainRef id={u.chainID} base={base} />
            </SpecLine>
          )}
          {u.address && (
            <SpecLine label="Validator Manager Contract">
              <HashChip value={u.address} len={66} />
            </SpecLine>
          )}
        </>
      )}
    </Sheet>
  );
}

/* the conversion's first validator set, as submitted */
export function InitialValidatorSet({ validators, subnetId, base }: { validators: L1InitialValidator[]; subnetId?: string; base: string }) {
  const [nodeIds, setNodeIds] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    Promise.all(validators.map(async (v) => [v.nodeID, await hexToNodeId(v.nodeID)] as const)).then((pairs) => {
      if (!cancelled) setNodeIds(Object.fromEntries(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [validators]);
  const cols = "md:grid-cols-[minmax(0,1fr)_8rem_10rem]";
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader label={`Initial Validator Set · ${validators.length}`} />
      <Board>
        <div className={cn(HEAD, cols)}>
          <span>Node</span>
          <span className="text-right">Weight</span>
          <span className="text-right">Balance</span>
        </div>
        {validators.map((v) => {
          const nodeId = nodeIds[v.nodeID];
          return (
            <div key={v.nodeID} className={cn(ROW, cols)}>
              <span className="col-span-2 min-w-0 md:col-span-1">
                {nodeId ? (
                  <HashChip value={nodeId} href={`${base}/node/${nodeId}${subnetId ? `?subnet=${subnetId}` : ""}`} len={60} />
                ) : (
                  <span className={MUTED}>{truncate(v.nodeID, 14)}</span>
                )}
              </span>
              <span className={cn(INK, "md:text-right")}>
                <CellLabel>Weight</CellLabel>
                {v.weight.toLocaleString("en-US")}
              </span>
              <span className={cn(INK, "md:text-right")}>
                <CellLabel>Balance</CellLabel>
                {formatAvax(v.balance)}
              </span>
            </div>
          );
        })}
      </Board>
    </section>
  );
}

/* RegisterL1ValidatorTx / SetL1ValidatorWeightTx: the inputs ride inside a
   signed Warp message the indexer keeps as bytes. The decoded call is laid
   out, with the raw message and the BLS proof for anyone who verifies. */
export function useWarpMessage(u: PlatformUnsignedTx | null): DecodedL1WarpMessage | null {
  const [decoded, setDecoded] = useState<DecodedL1WarpMessage | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (u?.message) decodeL1WarpMessage(u.message).then((d) => !cancelled && setDecoded(d));
    else setDecoded(null);
    return () => {
      cancelled = true;
    };
  }, [u]);
  return decoded;
}

export function WarpSheet({ u, decoded, loading, base }: { u: PlatformUnsignedTx | null; decoded: DecodedL1WarpMessage | null; loading: boolean; base: string }) {
  const pop = Array.isArray(u?.proofOfPossession) ? bytesToHex(u.proofOfPossession) : u?.proofOfPossession;
  return (
    <Sheet label={decoded?.kind === "weight" ? "L1 Weight Update" : "L1 Validator Registration"}>
      {loading || !u ? (
        <Bones />
      ) : (
        <>
          {decoded?.kind === "register" && (
            <>
              <SpecLine label="Subnet">
                <SubnetChip base={base} subnetId={decoded.subnetId} />
              </SpecLine>
              <SpecLine label="Node ID">
                <HashChip value={decoded.nodeId} href={`${base}/node/${decoded.nodeId}?subnet=${decoded.subnetId}`} len={66} />
              </SpecLine>
              <SpecLine label="Weight">{decoded.weight.toLocaleString("en-US")}</SpecLine>
              {u.balance !== undefined && <SpecLine label="Initial Balance">{formatAvax(u.balance)}</SpecLine>}
              <SpecLine label="Registration Expiry">
                {formatTime(decoded.expiry)} · {timeAgo(decoded.expiry)}
              </SpecLine>
              <SpecLine label="BLS Public Key">
                <HashChip value={decoded.blsPublicKey} len={120} />
              </SpecLine>
              {pop && (
                <SpecLine label="BLS Proof of Possession">
                  <HashChip value={pop} len={120} />
                </SpecLine>
              )}
              <SpecLine label="Remaining Balance Owner" align="start">
                <OwnerCell base={base} owner={decoded.remainingBalanceOwner} />
              </SpecLine>
              <SpecLine label="Deactivation Owner" align="start">
                <OwnerCell base={base} owner={decoded.disableOwner} />
              </SpecLine>
            </>
          )}
          {decoded?.kind === "weight" && (
            <>
              <SpecLine label="Validation ID">
                <HashChip value={decoded.validationId} len={66} />
              </SpecLine>
              <SpecLine label="New Weight">{decoded.weight.toLocaleString("en-US")}</SpecLine>
              <SpecLine label="Nonce">{decoded.nonce.toLocaleString("en-US")}</SpecLine>
            </>
          )}
          {decoded && (
            <>
              <SpecLine label="Manager Chain">
                <ChainRef id={decoded.sourceChainId} base={base} />
              </SpecLine>
              <SpecLine label="Validator Manager Contract">
                <HashChip value={decoded.sourceAddress} len={66} />
              </SpecLine>
            </>
          )}
          {u.message && (
            <SpecLine label={`Signed Warp Message · ${Math.floor((u.message.length - 2) / 2)} bytes`}>
              <HashChip value={u.message} len={48} />
            </SpecLine>
          )}
        </>
      )}
    </Sheet>
  );
}
