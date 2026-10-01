"use client";

import Link from "next/link";
import { Board, HashChip, SectionHeader, SpecLine, SpecSheet, SubjectHeadline } from "@/components/explorer-v2/ui";
import { formatAvax, formatNumber, formatTime, truncate } from "@/components/explorer-v2/format";
import { RailRow } from "@/components/explorer-v2/detail-parts";
import type { ConversionResponse } from "@/lib/pchain-explorer";
import type { CurrentValidator } from "@/lib/pchain-node";
import { balanceAt, useSecondClock } from "./seat-balance";
import { useL1NodeVersion, useSettledSeat } from "./node-data";
import { subnetName } from "./names";
import { STORY, STORY_INK, STORY_LINK } from "./tx-story";

/* The L1 validator's live record, straight from the P-Chain, split like
   the Primary Network view: the seat's story and its identifiers on the
   left, the readings in a rail. Slimmer than the indexer view (no uptime
   history or delegators: an L1 seat has neither), but authoritative. */

export function L1ValidatorView({
  network,
  nodeId,
  subnetId,
  otherSubnets = [],
  v,
  live = true,
  conversion,
  base,
}: {
  network: string;
  nodeId: string;
  subnetId: string;
  /** the node's other L1 seats: where to find its version when this seat's roster has it not */
  otherSubnets?: string[];
  v: CurrentValidator;
  /** false when the record came from the indexer snapshot instead of the node */
  live?: boolean;
  /** when this L1 was a subnet the node validated: the story says when it converted */
  conversion?: ConversionResponse | null;
  base: string;
}) {
  const seat = useSettledSeat(network, v.validationID);
  // the balance the chain will debit at its next block, a second at a time
  const now = useSecondClock(!!seat);
  const balance = seat ? balanceAt(seat, now) : v.balance !== undefined ? Number(v.balance) : undefined;
  const version = useL1NodeVersion(network, [subnetId, ...otherSubnets.filter((s) => s !== subnetId)], nodeId);
  // how long the balance pays the continuous fee at today's price
  const days = seat && seat.price > 0 && balance !== undefined ? balance / seat.price / 86_400 : null;
  // an ACP-77 seat validates an L1; a record without a validationID is a legacy subnet validator's
  const name = subnetName(subnetId) ?? `${v.validationID ? "L1" : "subnet"} ${truncate(subnetId, 8)}`;
  const owners = [
    ...(v.remainingBalanceOwner?.addresses ?? []).map((a) => ({ label: "Remaining Balance Owner", a })),
    ...(v.deactivationOwner?.addresses ?? []).map((a) => ({ label: "Deactivation Owner", a })),
  ];

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-5">
        <SectionHeader label="L1 Validator" />
        <SubjectHeadline value={nodeId} copyLabel="Copy NodeID" />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="flex min-w-0 flex-col gap-6">
            {/* the seat's story: what it validates, what pays for it, for how long */}
            <Board divide={false}>
              <p className={STORY}>
                <span className={STORY_INK} title={nodeId}>
                  {truncate(nodeId, 13)}
                </span>{" "}
                validates{" "}
                <Link href={`${base}/tx/${subnetId}`} className={STORY_LINK} title={subnetId}>
                  {name}
                </Link>{" "}
                with weight {formatNumber(Number(v.weight))}
                {v.startTime && <> since {formatTime(Number(v.startTime)).slice(0, 10)}</>}.{" "}
                {balance === undefined ? null : balance > 0 ? (
                  <>
                    Its balance of <span className={STORY_INK}>{formatAvax(balance)}</span> pays the continuous fee
                    {seat && <> of {formatNumber(seat.price)} nAVAX a second</>}
                    {days !== null && <>: {days >= 1 ? `about ${formatNumber(Math.floor(days))} day${Math.floor(days) === 1 ? "" : "s"}` : "less than a day"} at today&apos;s price</>}.
                  </>
                ) : (
                  <>Its balance has run out: the seat stays inactive until a top-up.</>
                )}
                {conversion?.txHash && conversion.timestamp ? (
                  <>
                    {" "}
                    {name} ran as a subnet until it{" "}
                    <Link href={`${base}/tx/${conversion.txHash}`} className={STORY_LINK} title={conversion.txHash}>
                      converted to an L1
                    </Link>{" "}
                    on {formatTime(conversion.timestamp).slice(0, 10)}.
                  </>
                ) : null}
              </p>
            </Board>
            <Board divide={false} className="px-5 md:px-6">
              <SpecSheet>
                <SpecLine label={v.validationID ? "L1" : "Subnet"}>
                  <HashChip value={subnetId} href={`${base}/tx/${subnetId}`} len={66} />
                </SpecLine>
                {v.validationID && (
                  <SpecLine label="Validation ID">
                    <HashChip value={v.validationID} len={66} />
                  </SpecLine>
                )}
                {v.startTime && <SpecLine label="Start">{formatTime(Number(v.startTime))}</SpecLine>}
                {v.publicKey && (
                  <SpecLine label="BLS Public Key" align="start">
                    <HashChip value={v.publicKey} len={120} />
                  </SpecLine>
                )}
                {owners.map((o) => (
                  <SpecLine key={`${o.label}-${o.a}`} label={o.label}>
                    <HashChip value={o.a} href={`${base}/address/${o.a.replace(/^P-/, "")}`} len={66} />
                  </SpecLine>
                ))}
              </SpecSheet>
            </Board>
          </div>

          {/* the readings: the balance ticks down a second at a time between blocks */}
          <Board divide={false} className="flex flex-col border">
            <RailRow label="Weight" sub={live ? "from the P-Chain's current validator set" : undefined}>
              {formatNumber(Number(v.weight))}
            </RailRow>
            {balance !== undefined && (
              <RailRow
                label="Balance"
                live={!!seat && balance > 0}
                sub={seat && seat.balance > 0 ? `less ${formatNumber(seat.price)} nAVAX/s since block ${formatNumber(seat.height)} · ${formatTime(seat.settledAt)}` : undefined}
              >
                {formatAvax(balance)}
              </RailRow>
            )}
            {seat && (
              <RailRow label="Continuous Fee">{formatNumber(seat.price)} nAVAX/s</RailRow>
            )}
            {version !== undefined && (
              <RailRow label="AvalancheGo" sub={version ? "as the network crawler reports it" : "no roster reports a version for it"}>
                {version ?? "Unknown"}
              </RailRow>
            )}
          </Board>
        </div>
        {!live && (
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
            The node did not answer, so these figures come from the indexer&apos;s last snapshot and can be out of date.
          </p>
        )}
      </section>
    </div>
  );
}
