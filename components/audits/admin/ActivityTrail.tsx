"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import type { AdminRequestDetail } from "@/server/services/audits/visibility";
import { CARD, MONO_LABEL_SM } from "@/components/audits/shared/classes";
import { ROW_ENTER } from "@/components/audits/shared/motion";
import { formatUsd } from "@/components/audits/shared/format";

type TrailEvent = AdminRequestDetail["events"][number];

function metaOf(event: TrailEvent): Record<string, unknown> {
  return event.meta && typeof event.meta === "object" && !Array.isArray(event.meta)
    ? (event.meta as Record<string, unknown>)
    : {};
}

/** Full list up to this many firms; beyond it, first three + "+N more". */
const FANOUT_NAMES_SHOWN = 4;

function fanoutFirmsSuffix(firms: string[]): string {
  if (firms.length === 0) return "";
  const shown =
    firms.length <= FANOUT_NAMES_SHOWN ? firms : firms.slice(0, FANOUT_NAMES_SHOWN - 1);
  const more = firms.length - shown.length;
  return ` · ${shown.join(", ")}${more > 0 ? ` +${more} more` : ""}`;
}

function eventLine(event: TrailEvent, fanoutFirms: string[]): string {
  const meta = metaOf(event);
  const firm = typeof meta.firm_name === "string" ? meta.firm_name : null;
  const price = typeof meta.price_usd === "number" ? formatUsd(meta.price_usd) : null;
  const admin = typeof meta.admin_name === "string" ? meta.admin_name : null;
  // The approved address behind an auditor action (team emails, 2026-09-02).
  const actor = typeof meta.actor_email === "string" ? meta.actor_email : null;

  switch (event.action) {
    case "request_submitted":
      return `Request submitted${typeof meta.project_name === "string" ? ` by ${meta.project_name}` : ""}`;
    case "request_returned_to_draft":
      return "Taken back to drafts by the project";
    case "request_approved":
      return ["Request approved for fan-out", admin ? `by ${admin}` : null]
        .filter(Boolean)
        .join(" · ");
    case "request_rejected":
      return [
        "Request rejected",
        admin ? `by ${admin}` : null,
        typeof meta.reason === "string" && meta.reason ? meta.reason : null,
      ]
        .filter(Boolean)
        .join(" · ");
    case "fanout_created":
      return `Fanned out to ${typeof meta.auditor_count === "number" ? meta.auditor_count : "all"} whitelisted firms${fanoutFirmsSuffix(fanoutFirms)}`;
    case "quote_submitted":
      return ["Quote submitted", firm, actor ? `by ${actor}` : null, price]
        .filter(Boolean)
        .join(" · ");
    case "quote_updated":
      return ["Quote updated", firm, actor ? `by ${actor}` : null, price]
        .filter(Boolean)
        .join(" · ");
    case "quote_accepted":
      return ["Quote accepted", firm, price].filter(Boolean).join(" · ");
    case "contacts_revealed":
      return "Contacts revealed both ways";
    case "subsidy_approved": {
      const amount =
        typeof meta.program_amount_usd === "number" ? formatUsd(meta.program_amount_usd) : null;
      const share = typeof meta.pct === "number" ? `(${meta.pct}%)` : null;
      return [
        "Subsidy approved",
        amount ? `${amount}${share ? ` ${share}` : ""}` : share,
        admin ? `by ${admin}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    }
    case "subsidy_declined":
      return ["Subsidy declined", admin ? `by ${admin}` : null].filter(Boolean).join(" · ");
    case "request_withdrawn":
      return "Request withdrawn by the project";
    case "request_reopened":
      return "Request reopened for one more round";
    default:
      return event.action.replaceAll("_", " ");
  }
}

const stamp = (date: Date) => {
  const iso = new Date(date).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
};

/** The audit trail admins rely on instead of pings (design 1b, order
 * amended by Federico in loop-test): NEWEST FIRST in a card, stamps in a
 * fixed mono gutter, the amber PENDING row on top while the subsidy
 * decision is outstanding. */
export function ActivityTrail({
  events,
  fanoutFirms = [],
  pendingDecision = false,
}: {
  events: AdminRequestDetail["events"];
  /** Firm names from the fan-out deliveries snapshot (the "which ones"). */
  fanoutFirms?: string[];
  /** Engaged with no subsidy decision on file: the trail's call to action. */
  pendingDecision?: boolean;
}) {
  // Rows present at first render are "seen"; only rows arriving later (the
  // router.refresh after a decision) get the entrance animation.
  const seenRef = useRef<Set<string> | null>(null);
  const firstRender = seenRef.current === null;
  if (seenRef.current === null) seenRef.current = new Set(events.map((event) => event.id));
  const seen = seenRef.current;
  const freshIds = firstRender
    ? new Set<string>()
    : new Set(events.filter((event) => !seen.has(event.id)).map((event) => event.id));
  for (const id of freshIds) seen.add(id);

  return (
    <section className={`${CARD} p-5`}>
      <h2 className={MONO_LABEL_SM}>
        Activity · the audit trail admins rely on instead of pings
      </h2>
      {events.length === 0 && !pendingDecision ? (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Nothing yet.</p>
      ) : (
        <ul className="mt-3 max-h-[26rem] space-y-2.5 overflow-y-auto pr-2">
          {pendingDecision ? (
            <li className="flex gap-3 text-sm text-amber-700 dark:text-amber-400">
              <span className="w-[88px] shrink-0 font-mono text-xs uppercase leading-5">
                Pending
              </span>
              <span className="min-w-0 leading-5">Subsidy decision · worksheet on the right</span>
            </li>
          ) : null}
          {events.map((event) => (
            <li
              key={event.id}
              className={cn("flex gap-3 text-sm", freshIds.has(event.id) && ROW_ENTER)}
            >
              <span className="w-[88px] shrink-0 font-mono text-xs leading-5 text-zinc-400 dark:text-zinc-500">
                {stamp(event.created_at)}
              </span>
              <span
                className={cn(
                  "min-w-0 leading-5",
                  event.action === "quote_accepted"
                    ? "font-semibold text-zinc-950 dark:text-zinc-50"
                    : "text-zinc-700 dark:text-zinc-300",
                )}
              >
                {eventLine(event, fanoutFirms)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
