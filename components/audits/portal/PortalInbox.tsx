"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { AuditorInboxItem } from "@/server/services/audits/visibility";
import { CountdownChip } from "@/components/audits/shared/CountdownChip";
import { EmptyState } from "@/components/audits/shared/EmptyState";
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

function metaStrip(item: AuditorInboxItem): string {
  const request = item.request;
  const stack = [...request.languages, ...request.frameworks].join(" / ");
  const repoCount = parseRepos(request.repos).length;
  return [
    ...(request.services.length > 0 ? [request.services[0]] : []),
    ...(request.nsloc ? [`~${request.nsloc.toLocaleString("en-US")} nSLOC`] : []),
    ...(stack ? [stack] : []),
    ...(repoCount > 0 ? [`${repoCount} repos pinned`] : []),
    ...(request.needed_by ? [`needed by ${formatIsoDate(request.needed_by)}`] : []),
    ...(request.urgency ? [URGENCY_LABELS[request.urgency as UrgencyOption] ?? ""] : []),
  ]
    .filter(Boolean)
    .join(" · ");
}

function quoteLine(item: AuditorInboxItem): string | null {
  const quote = item.own_quote;
  if (!quote) return null;
  if (quote.status === "accepted") return "Won · view contact details";
  if (quote.status === "not_selected") return "Not selected for this request";
  const edit = item.window_open
    ? `editable until ${item.request.quote_deadline ? formatIsoDate(item.request.quote_deadline) : "the window closes"}`
    : "window closed · project deciding";
  return `You quoted ${formatUsd(quote.price_usd)} · ${edit}`;
}

/** Inbox, comfortable cards (design 1b · picked for current volume). */
export function PortalInbox({
  items,
  quoteEmail,
}: {
  items: AuditorInboxItem[];
  quoteEmail: string;
}) {
  const [tab, setTab] = useState<Tab>("all");

  if (items.length === 0) {
    return (
      <EmptyState
        headline="No open requests right now"
        body={`When an ecosystem project requests quotes, it lands here and you get an email at ${quoteEmail}.`}
        footnote="Nothing to check · the email is the trigger"
      />
    );
  }

  const counts = {
    all: items.length,
    awaiting: items.filter((item) => bucketOf(item) === "awaiting").length,
    quoted: items.filter((item) => bucketOf(item) === "quoted").length,
    won: items.filter((item) => bucketOf(item) === "won").length,
  };
  const tabs: { value: Tab; label: string }[] = [
    { value: "all", label: "All" },
    { value: "awaiting", label: "Awaiting your quote" },
    { value: "quoted", label: "Quoted" },
    { value: "won", label: "Won" },
  ];

  const visible = tab === "all" ? items : items.filter((item) => bucketOf(item) === tab);

  return (
    <div className="py-8">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter requests">
        {tabs.map((entry) => (
          <button
            key={entry.value}
            type="button"
            aria-pressed={tab === entry.value}
            onClick={() => setTab(entry.value)}
            className={cn(
              "h-9 cursor-pointer rounded-full border px-3.5 text-sm transition-colors",
              tab === entry.value
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 text-zinc-600 hover:border-zinc-500 dark:border-white/15 dark:text-zinc-400 dark:hover:border-white/40",
            )}
          >
            {entry.label} <span className="opacity-70">{counts[entry.value]}</span>
          </button>
        ))}
      </div>

      <ul className="mt-5 space-y-3">
        {visible.map((item) => {
          const bucket = bucketOf(item);
          const receded = bucket === "quoted" || bucket === "won" || bucket === "closed";
          return (
            <li key={item.request.id}>
              <Link
                href={`/audits/portal/requests/${item.request.id}`}
                className={cn(
                  "block rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-400 dark:border-white/10 dark:bg-[#1F1F1F] dark:hover:border-white/25",
                  receded && "opacity-80",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{item.request.project_name || "Untitled request"}</p>
                  {item.window_open && item.request.quote_deadline ? (
                    <CountdownChip
                      deadline={item.request.quote_deadline}
                      prefix="Quote closes"
                      palette="portal"
                    />
                  ) : (
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      {bucket === "won" ? "Won" : "Window closed"}
                    </span>
                  )}
                </div>
                {item.request.description ? (
                  <p className="mt-2 text-sm text-zinc-600 dark:text-[#A2AFB2]">
                    {truncate(item.request.description)}
                  </p>
                ) : null}
                <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {metaStrip(item)}
                </p>
                {quoteLine(item) ? (
                  <p className="mt-2 text-sm font-medium">{quoteLine(item)}</p>
                ) : (
                  <p className="mt-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Review &amp; quote
                  </p>
                )}
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
