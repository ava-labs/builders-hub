"use client";

import Link from "next/link";
import { CalendarDays, ChevronRight, Clock, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OwnerRequestSummary } from "@/server/services/audits/visibility";
import { CARD, MONO_LABEL } from "@/components/audits/shared/classes";
import { CHEVRON_NUDGE, HOVER_LIFT, ROW_ENTER } from "@/components/audits/shared/motion";
import { StatusBadge } from "@/components/audits/shared/StatusBadge";
import { CountdownChip } from "@/components/audits/shared/CountdownChip";
import {
  formatIsoDate,
  formatQuoteRange,
  quoteCountLabel,
  truncate,
} from "@/components/audits/shared/format";

const BADGE_SUFFIX: Record<string, string> = {
  deciding: "· pick one",
  engaged: "· auditor engaged",
};

function cardMeta(request: OwnerRequestSummary): string | null {
  if (request.display_status === "collecting" && request.quote_count > 0) {
    return `${quoteCountLabel(request.quote_count)} in`;
  }
  if (request.quote_count > 0 && request.quote_price_range) {
    const { min, max } = request.quote_price_range;
    return `${quoteCountLabel(request.quote_count)} · ${formatQuoteRange(min, max)}`;
  }
  return null;
}

interface RequestCardProps {
  request: OwnerRequestSummary;
  /** Index in the visible list, drives the one-time stagger entrance. */
  index: number;
  onDeleteDraft: (request: OwnerRequestSummary) => void;
}

/** One request on My requests (board 1d): closed cards recede, drafts dash. */
export function RequestCard({ request, index, onDeleteDraft }: RequestCardProps) {
  const isDraft = request.display_status === "draft";
  const isClosed = ["engaged", "expired", "withdrawn"].includes(request.display_status);
  const href = isDraft ? `/audits/new?draft=${request.id}` : `/audits/${request.id}`;
  const meta = cardMeta(request);

  return (
    <li className={cn(ROW_ENTER, "fill-mode-backwards")} style={{ animationDelay: `${index * 30}ms` }}>
      <Link
        href={href}
        className={cn(
          CARD,
          HOVER_LIFT,
          "group block p-5 hover:border-zinc-400 dark:hover:border-white/25",
          isDraft && "border-dashed",
          isClosed && "bg-zinc-50 dark:bg-white/[0.03]",
        )}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className={cn("font-semibold", isClosed && "text-zinc-600 dark:text-zinc-300")}>
            {request.project_name || "Untitled request"}
          </p>
          <StatusBadge
            status={request.display_status}
            suffix={BADGE_SUFFIX[request.display_status]}
          />
          <span className="flex-1" />
          {meta ? <p className={MONO_LABEL}>{meta}</p> : null}
          {isDraft ? (
            <button
              type="button"
              aria-label={`Delete draft ${request.project_name || "Untitled request"}`}
              title="Delete draft"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onDeleteDraft(request);
              }}
              className="-m-2 cursor-pointer rounded-md p-2 text-zinc-400 transition-colors hover:text-brand dark:text-zinc-500 dark:hover:text-brand-soft"
            >
              <Trash2 aria-hidden className="h-4 w-4" />
            </button>
          ) : (
            <ChevronRight
              aria-hidden
              className={cn("h-4 w-4 text-zinc-400 dark:text-zinc-500", CHEVRON_NUDGE)}
            />
          )}
        </div>
        {request.description ? (
          <p className="mt-2 text-sm text-zinc-600 dark:text-[#A2AFB2]">
            {truncate(request.description)}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
          {request.display_status === "collecting" && request.quote_deadline ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock aria-hidden className="h-3.5 w-3.5" />
              <CountdownChip deadline={request.quote_deadline} prefix="Quotes close" /> ·{" "}
              {formatIsoDate(request.quote_deadline)}
            </span>
          ) : null}
          {request.needed_by ? (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays aria-hidden className="h-3.5 w-3.5" />
              Needed by{" "}
              <span className="text-zinc-700 dark:text-zinc-300">
                {formatIsoDate(request.needed_by)}
              </span>
            </span>
          ) : null}
          {isDraft ? <span>Edited {formatIsoDate(request.updated_at)} · continue editing</span> : null}
        </div>
      </Link>
    </li>
  );
}
