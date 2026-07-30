"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { OwnerRequestSummary } from "@/server/services/audits/visibility";
import { StatusBadge } from "@/components/audits/shared/StatusBadge";
import { CountdownChip } from "@/components/audits/shared/CountdownChip";
import { formatIsoDate, truncate } from "@/components/audits/shared/format";

type Filter = "all" | "collecting" | "deciding" | "closed" | "drafts";

const FILTER_OF_STATUS: Record<string, Exclude<Filter, "all">> = {
  collecting: "collecting",
  deciding: "deciding",
  engaged: "closed",
  expired: "closed",
  withdrawn: "closed",
  draft: "drafts",
};

const FILTER_LABELS: Record<Exclude<Filter, "all">, string> = {
  collecting: "Collecting quotes",
  deciding: "Quotes ready",
  closed: "Closed",
  drafts: "Drafts",
};

const BADGE_SUFFIX: Record<string, string> = {
  deciding: "· pick one",
  engaged: "· auditor engaged",
};

const kUsd = (value: number) => `$${Math.round(value / 1000)}K`;

function cardMeta(request: OwnerRequestSummary): string | null {
  if (request.display_status === "collecting" && request.quote_count > 0) {
    return `${request.quote_count} quotes in`;
  }
  if (request.quote_count > 0 && request.quote_price_range) {
    const { min, max } = request.quote_price_range;
    return `${request.quote_count} quotes · ${kUsd(min)}–${kUsd(max)}`;
  }
  return null;
}

export function MyRequestsList({
  requests,
  isAdmin = false,
  isAuditor = false,
}: {
  requests: OwnerRequestSummary[];
  isAdmin?: boolean;
  isAuditor?: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [deletingDraft, setDeletingDraft] = useState<OwnerRequestSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const deleteDraft = async () => {
    if (!deletingDraft) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/audits/requests/${deletingDraft.id}`, { method: "DELETE" });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        toast.error(body?.message ?? "We couldn't delete this draft.");
        return;
      }
      toast.success("Draft deleted.");
      setDeletingDraft(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const counts = requests.reduce<Record<Exclude<Filter, "all">, number>>(
    (acc, request) => {
      const key = FILTER_OF_STATUS[request.display_status] ?? "closed";
      return { ...acc, [key]: acc[key] + 1 };
    },
    { collecting: 0, deciding: 0, closed: 0, drafts: 0 },
  );

  const visible =
    filter === "all"
      ? requests
      : requests.filter((request) => (FILTER_OF_STATUS[request.display_status] ?? "closed") === filter);

  const chips: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "All", count: requests.length },
    ...(Object.keys(FILTER_LABELS) as Exclude<Filter, "all">[])
      .map((value) => ({ value, label: FILTER_LABELS[value], count: counts[value] }))
      .filter((chip) => chip.count > 0),
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit requests</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-[#A2AFB2]">
            Quotes from the Ava Labs whitelist, free and private to you.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAuditor ? (
            <Link
              href="/audits/portal"
              className="inline-flex h-11 items-center rounded-lg border border-zinc-300 px-4 text-sm font-medium transition-colors hover:border-zinc-500 dark:border-white/15 dark:hover:border-white/40 md:h-10"
            >
              Auditor portal
            </Link>
          ) : null}
          {isAdmin ? (
            <Link
              href="/audits/admin"
              className="inline-flex h-11 items-center rounded-lg border border-zinc-300 px-4 text-sm font-medium transition-colors hover:border-zinc-500 dark:border-white/15 dark:hover:border-white/40 md:h-10"
            >
              Admin dashboard
            </Link>
          ) : null}
          <Link
            href="/audits/new"
            className="inline-flex h-11 items-center rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 md:h-10"
          >
            New request
          </Link>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter requests">
        {chips.map((chip) => (
          <button
            key={chip.value}
            type="button"
            aria-pressed={filter === chip.value}
            onClick={() => setFilter(chip.value)}
            className={cn(
              "h-9 cursor-pointer rounded-full border px-3.5 text-sm transition-colors",
              filter === chip.value
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 text-zinc-600 hover:border-zinc-500 dark:border-white/15 dark:text-zinc-400 dark:hover:border-white/40",
            )}
          >
            {chip.label} <span className="opacity-70">{chip.count}</span>
          </button>
        ))}
      </div>

      <ul className="mt-6 space-y-3">
        {visible.map((request) => {
          const href =
            request.display_status === "draft"
              ? `/audits/new?draft=${request.id}`
              : `/audits/${request.id}`;
          const meta = cardMeta(request);
          return (
            <li key={request.id}>
              <Link
                href={href}
                className="block rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-400 dark:border-white/10 dark:bg-[#1F1F1F] dark:hover:border-white/25"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{request.project_name || "Untitled request"}</p>
                  <span className="flex items-center gap-2">
                    {meta ? (
                      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                        {meta}
                      </p>
                    ) : null}
                    {request.display_status === "draft" ? (
                      <button
                        type="button"
                        aria-label={`Delete draft ${request.project_name || "Untitled request"}`}
                        title="Delete draft"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setDeletingDraft(request);
                        }}
                        className="-m-2 cursor-pointer rounded-md p-2 text-zinc-400 transition-colors hover:text-brand dark:text-zinc-500 dark:hover:text-brand-soft"
                      >
                        <Trash2 aria-hidden className="h-4 w-4" />
                      </button>
                    ) : null}
                  </span>
                </div>
                <StatusBadge
                  className="mt-1.5"
                  status={request.display_status}
                  suffix={BADGE_SUFFIX[request.display_status]}
                />
                {request.description ? (
                  <p className="mt-2 text-sm text-zinc-600 dark:text-[#A2AFB2]">
                    {truncate(request.description)}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {request.display_status === "collecting" && request.quote_deadline ? (
                    <span>
                      <CountdownChip deadline={request.quote_deadline} prefix="Quotes close" />{" "}
                      · {formatIsoDate(request.quote_deadline)}
                    </span>
                  ) : null}
                  {request.needed_by ? (
                    <span>
                      Needed by{" "}
                      <span className="text-zinc-700 dark:text-zinc-300">
                        {formatIsoDate(request.needed_by)}
                      </span>
                    </span>
                  ) : null}
                  {request.display_status === "draft" ? (
                    <span>Edited {formatIsoDate(request.updated_at)} · continue editing</span>
                  ) : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {visible.length === 0 ? (
        <p className="mt-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Nothing under this filter.
        </p>
      ) : null}

      <p className="mt-10 text-center text-xs text-zinc-400 dark:text-zinc-500">
        Quoting as a whitelisted security firm?{" "}
        <Link
          href="/audits/portal"
          className="underline underline-offset-2 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Open the auditor portal
        </Link>
        .
      </p>

      <AlertDialog
        open={deletingDraft !== null}
        onOpenChange={(open) => (!open ? setDeletingDraft(null) : null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete draft {deletingDraft?.project_name || "Untitled request"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the draft and everything typed into it. Only drafts can be
              deleted; submitted requests stay on record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep draft</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void deleteDraft()}>
              Delete draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
