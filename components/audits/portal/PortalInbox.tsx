"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { AuditorInboxItem } from "@/server/services/audits/visibility";
import { CountdownChip } from "@/components/audits/shared/CountdownChip";
import { EmptyState } from "@/components/audits/shared/EmptyState";
import { StatusBadge } from "@/components/audits/shared/StatusBadge";
import { DeactivatedBanner } from "@/components/audits/portal/DeactivatedBanner";
import { CARD } from "@/components/audits/shared/classes";
import { HOVER_LIFT, ROW_ENTER } from "@/components/audits/shared/motion";
import { formatIsoDate, formatUsd, truncate } from "@/components/audits/shared/format";
import { URGENCY_LABELS } from "@/lib/audits/constants";
import type { UrgencyOption } from "@/lib/audits/status";
import { parseRepos } from "@/components/audits/wizard/types";

type Tab = "all" | "awaiting" | "quoted" | "won";

function bucketOf(item: AuditorInboxItem): Exclude<Tab, "all"> | "closed" {
  if (item.own_quote?.status === "accepted") return "won";
  if (item.own_quote && item.own_quote.status === "submitted" && item.window_open) return "quoted";
  if (item.window_open && !item.own_quote) return "awaiting";
  if (item.own_quote?.status === "submitted") return "quoted";
  return "closed";
}

/** The meta strip's lead token (the service) renders brighter than the rest (1b). */
function metaParts(item: AuditorInboxItem): { lead: string | null; rest: string } {
  const request = item.request;
  const stack = [...request.languages, ...request.frameworks].join(" / ");
  const repoCount = parseRepos(request.repos).length;
  const rest = [
    ...(request.nsloc ? [`~${request.nsloc.toLocaleString("en-US")} nSLOC`] : []),
    ...(stack ? [stack] : []),
    ...(repoCount > 0 ? [`${repoCount} repos pinned`] : []),
    ...(request.needed_by ? [`needed by ${formatIsoDate(request.needed_by)}`] : []),
    ...(request.urgency ? [URGENCY_LABELS[request.urgency as UrgencyOption] ?? ""] : []),
  ]
    .filter(Boolean)
    .join(" · ");
  return { lead: request.services[0] ?? null, rest };
}

/** The card's status slot: countdown while awaiting, a status pill otherwise (1b). */
function CardPill({ item }: { item: AuditorInboxItem }) {
  const bucket = bucketOf(item);
  if (bucket === "awaiting" && item.request.quote_deadline) {
    return <CountdownChip deadline={item.request.quote_deadline} prefix="Quote closes" pill />;
  }
  const quote = item.own_quote;
  if (bucket === "won" && quote) {
    return (
      <StatusBadge
        kind="quote"
        status="accepted"
        label="Won"
        suffix={item.request.closed_at ? `· engaged ${formatIsoDate(item.request.closed_at)}` : undefined}
      />
    );
  }
  if (quote?.status === "not_selected") {
    return <StatusBadge kind="quote" status="not_selected" />;
  }
  if (quote) {
    return (
      <StatusBadge
        kind="quote"
        status="submitted"
        label={`You quoted ${formatUsd(quote.price_usd)}`}
      />
    );
  }
  return <StatusBadge kind="quote" status="expired" label="Window closed" />;
}

/** Inbox, comfortable cards (design 1b · picked for current volume). */
export function PortalInbox({
  items,
  notifyEmail,
  readOnly = false,
}: {
  items: AuditorInboxItem[];
  /** The signed-in address: quote email or approved teammate, both get the mail. */
  notifyEmail: string;
  /** Deactivated firms browse their history without action affordances (N-4). */
  readOnly?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("all");

  if (items.length === 0) {
    // A deactivated firm with no history still needs the banner (the plain
    // early return skipped it) and copy that stops promising emails that
    // will never come (round-4 L4-2).
    const empty = (
      <EmptyState
        panel
        art={false}
        headline={readOnly ? "No past activity on record" : "No open requests right now"}
        body={
          readOnly
            ? "This firm had no requests or quotes before it was deactivated. New requests no longer fan out to it."
            : `When an ecosystem project requests quotes, it lands here and you get an email at ${notifyEmail}.`
        }
        footnote={readOnly ? undefined : "Nothing to check · the email is the trigger"}
      />
    );
    if (!readOnly) return empty;
    return (
      <div className="py-10">
        <DeactivatedBanner />
        {empty}
      </div>
    );
  }

  const counts = {
    all: items.length,
    awaiting: items.filter((item) => bucketOf(item) === "awaiting").length,
    quoted: items.filter((item) => bucketOf(item) === "quoted").length,
    won: items.filter((item) => bucketOf(item) === "won").length,
  };
  const tabs: { value: Tab; label: string; longLabel?: string }[] = [
    { value: "all", label: "All" },
    { value: "awaiting", label: "Awaiting", longLabel: "Awaiting your quote" },
    { value: "quoted", label: "Quoted" },
    { value: "won", label: "Won" },
  ];

  const visible = tab === "all" ? items : items.filter((item) => bucketOf(item) === tab);

  return (
    <div className="py-10">
      {readOnly ? <DeactivatedBanner /> : null}
      {/* Short nowrap labels keep the row on ONE line at 375 (board 1g); the
          full "Awaiting your quote" returns from md up. Targets stay 44px. */}
      <div
        className="flex gap-2 overflow-x-auto whitespace-nowrap"
        role="group"
        aria-label="Filter requests"
      >
        {tabs.map((entry) => (
          <button
            key={entry.value}
            type="button"
            aria-pressed={tab === entry.value}
            onClick={() => setTab(entry.value)}
            className={cn(
              "h-11 shrink-0 cursor-pointer rounded-full border px-4 text-sm transition-colors md:h-9 md:px-3.5",
              tab === entry.value
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 text-zinc-600 hover:border-zinc-500 dark:border-white/15 dark:text-zinc-400 dark:hover:border-white/40",
            )}
          >
            {entry.longLabel ? (
              <>
                {entry.label}
                <span className="hidden md:inline">
                  {entry.longLabel.slice(entry.label.length)}
                </span>
              </>
            ) : (
              entry.label
            )}{" "}
            <span
              className={cn(
                "font-mono text-xs",
                entry.value === "awaiting" && counts.awaiting > 0
                  ? "text-brand-deep dark:text-brand-soft"
                  : "opacity-70",
              )}
            >
              {counts[entry.value]}
            </span>
          </button>
        ))}
      </div>

      <ul className="mt-5 space-y-3">
        {visible.map((item, index) => {
          const bucket = bucketOf(item);
          const receded = bucket !== "awaiting";
          const meta = metaParts(item);
          return (
            <li
              key={item.request.id}
              className={cn(ROW_ENTER, "fill-mode-backwards")}
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <Link
                href={`/audits/portal/requests/${item.request.id}`}
                className={cn(
                  CARD,
                  HOVER_LIFT,
                  "block p-5 hover:border-zinc-400 dark:hover:border-white/25",
                  receded && "opacity-[0.82]",
                )}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <p className="font-semibold">{item.request.project_name || "Untitled request"}</p>
                  <CardPill item={item} />
                  <span className="flex-1" />
                  {readOnly ? null : bucket === "awaiting" ? (
                    <span className="hidden rounded-lg bg-zinc-900 px-3.5 py-1.5 text-sm font-medium text-white sm:inline-block dark:bg-zinc-100 dark:text-zinc-900">
                      Review &amp; quote
                    </span>
                  ) : bucket === "quoted" && item.window_open ? (
                    <span className="hidden rounded-lg border border-zinc-300 px-3.5 py-1.5 text-sm font-medium text-zinc-700 sm:inline-block dark:border-white/15 dark:text-zinc-300">
                      Edit quote
                    </span>
                  ) : null}
                </div>
                {item.request.description ? (
                  <p className="mt-2 max-w-[100ch] text-sm leading-relaxed text-zinc-600 dark:text-[#A2AFB2]">
                    {truncate(item.request.description)}
                  </p>
                ) : null}
                <p className="mt-3 flex flex-wrap gap-x-3.5 gap-y-1 font-mono text-[11px] uppercase tracking-[0.04em]">
                  {meta.lead ? (
                    <span className="text-zinc-600 dark:text-[#A2AFB2]">{meta.lead}</span>
                  ) : null}
                  {meta.lead && meta.rest ? (
                    // The strip separates every other segment with a middot;
                    // this junction only had the flex gap (round-4 L4-4).
                    <span aria-hidden className="text-zinc-400 dark:text-[#7A8689]">
                      ·
                    </span>
                  ) : null}
                  {meta.rest ? (
                    <span className="text-zinc-400 dark:text-[#7A8689]">{meta.rest}</span>
                  ) : null}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
      {visible.length === 0 ? (
        <p className="mt-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Nothing under this tab.
        </p>
      ) : null}
    </div>
  );
}
