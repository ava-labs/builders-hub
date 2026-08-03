"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
import { AUDITS_DIALOG } from "@/components/audits/shared/classes";
import { RequestCard } from "@/components/audits/landing/RequestCard";

type Filter = "all" | "review" | "collecting" | "deciding" | "closed" | "drafts";

const FILTER_OF_STATUS: Record<string, Exclude<Filter, "all">> = {
  pending_review: "review",
  collecting: "collecting",
  deciding: "deciding",
  engaged: "closed",
  expired: "closed",
  withdrawn: "closed",
  rejected: "closed",
  draft: "drafts",
};

const FILTER_LABELS: Record<Exclude<Filter, "all">, string> = {
  review: "Awaiting approval",
  collecting: "Collecting quotes",
  deciding: "Quotes ready",
  closed: "Closed",
  drafts: "Drafts",
};

export function MyRequestsList({
  requests,
  isAdmin = false,
  isAuditor = false,
}: {
  requests: OwnerRequestSummary[];
  /** Role doors ride here too, not only on first-run: an admin or auditor who
      files a single request would otherwise never see them again. */
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
    { review: 0, collecting: 0, deciding: 0, closed: 0, drafts: 0 },
  );

  const visible =
    filter === "all"
      ? requests
      : requests.filter(
          (request) => (FILTER_OF_STATUS[request.display_status] ?? "closed") === filter,
        );

  const chips: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "All", count: requests.length },
    ...(Object.keys(FILTER_LABELS) as Exclude<Filter, "all">[])
      .map((value) => ({ value, label: FILTER_LABELS[value], count: counts[value] }))
      .filter((chip) => chip.count > 0),
  ];

  return (
    <div className="mx-auto max-w-[1040px] px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit requests</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-[#A2AFB2]">
            Quotes from the Ava Labs whitelist, free and private to you.
          </p>
        </div>
        {/* Doors first, red CTA last: the outline buttons keep "one red CTA
            per view" intact while giving role holders a way back. */}
        <div className="flex flex-wrap items-center gap-2">
          {isAuditor ? (
            <Link
              href="/audits/portal"
              className="inline-flex h-11 items-center rounded-lg border border-zinc-300 px-4 text-sm font-medium transition-colors hover:border-zinc-500 md:h-10 dark:border-white/15 dark:hover:border-white/40"
            >
              Auditor portal
            </Link>
          ) : null}
          {isAdmin ? (
            <Link
              href="/audits/admin"
              className="inline-flex h-11 items-center rounded-lg border border-zinc-300 px-4 text-sm font-medium transition-colors hover:border-zinc-500 md:h-10 dark:border-white/15 dark:hover:border-white/40"
            >
              Admin dashboard
            </Link>
          ) : null}
          <Link
            href="/audits/new"
            className="audits-sweep group inline-flex h-11 items-center gap-1.5 rounded-lg bg-brand px-4 text-sm font-semibold text-white transition-colors md:h-10"
          >
            <Plus
              aria-hidden
              className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90"
            />
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
              chip.value === "drafts" && filter !== chip.value && "border-dashed",
            )}
          >
            {chip.label} <span className="opacity-70">{chip.count}</span>
          </button>
        ))}
      </div>

      <ul className="mt-6 space-y-3">
        {visible.map((request, index) => (
          <RequestCard
            key={request.id}
            request={request}
            index={index}
            onDeleteDraft={setDeletingDraft}
          />
        ))}
      </ul>
      {visible.length === 0 ? (
        <p className="mt-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Nothing under this filter.
        </p>
      ) : null}

      <AlertDialog
        open={deletingDraft !== null}
        onOpenChange={(open) => (!open ? setDeletingDraft(null) : null)}
      >
        <AlertDialogContent className={AUDITS_DIALOG}>
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
            <AlertDialogAction
              disabled={busy}
              onClick={() => void deleteDraft()}
              className="border border-brand-deep/35 bg-transparent text-brand-deep shadow-none hover:bg-brand-deep/5 dark:border-brand-soft/35 dark:text-brand-soft dark:hover:bg-brand-soft/10"
            >
              Delete draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
