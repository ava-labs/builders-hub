"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { MONO_LABEL_SM } from "@/components/audits/shared/classes";
import type { AdminRequestRow } from "@/server/services/audits/visibility";
import { StatusBadge } from "@/components/audits/shared/StatusBadge";
import { CountdownChip } from "@/components/audits/shared/CountdownChip";
import { formatIsoDate, formatQuoteRange, formatUsd } from "@/components/audits/shared/format";


function SubsidyCell({ row }: { row: AdminRequestRow }) {
  if (row.subsidy_state === "needs_approval") {
    // Amber per Foundations "needs action" (the row wash stays the only red).
    return <span className="font-medium text-amber-700 dark:text-amber-400">Needs approval</span>;
  }
  if (row.subsidy_state === "approved") {
    // Amount-first everywhere (locked 2026-07-30); pct is the view in brackets.
    return row.subsidy_amount_usd !== null ? (
      <span>
        Approved {formatUsd(row.subsidy_amount_usd)}{" "}
        <span className="text-zinc-500 dark:text-zinc-400">({row.subsidy_pct}%)</span>
      </span>
    ) : (
      <span>Approved {row.subsidy_pct}%</span>
    );
  }
  if (row.subsidy_state === "declined") {
    return <span className="text-zinc-500 dark:text-zinc-400">Declined</span>;
  }
  return <span className="text-zinc-400 dark:text-zinc-500">Awaiting pick</span>;
}

/**
 * The requests table (design 1a). "Needs approval" rows carry a faint red
 * wash, the one place attention is steered, since there are no pings. The
 * whole row navigates to the drill-down; the title stays a real link for
 * middle-click and keyboard users.
 */
export function RequestsTable({ rows }: { rows: AdminRequestRow[] }) {
  const router = useRouter();

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-zinc-200 p-6 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
        No requests match.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-white/10">
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-200 bg-zinc-50 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/[0.02] dark:hover:bg-white/[0.02]">
            <TableHead className={cn(MONO_LABEL_SM, "px-4")}>Request</TableHead>
            <TableHead className={MONO_LABEL_SM}>Submitted</TableHead>
            <TableHead className={MONO_LABEL_SM}>Quote deadline</TableHead>
            <TableHead className={MONO_LABEL_SM}>Quotes</TableHead>
            <TableHead className={MONO_LABEL_SM}>Range</TableHead>
            <TableHead className={MONO_LABEL_SM}>Status</TableHead>
            <TableHead className={MONO_LABEL_SM}>Subsidy</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              onClick={() => router.push(`/audits/admin/requests/${row.id}`)}
              className={cn(
                "cursor-pointer border-zinc-200 dark:border-white/10",
                row.subsidy_state === "needs_approval"
                  ? "bg-brand/5 hover:bg-brand/10 dark:hover:bg-brand/10"
                  : "hover:bg-zinc-50 dark:hover:bg-white/[0.03]",
              )}
            >
              <TableCell>
                <Link href={`/audits/admin/requests/${row.id}`} className="block">
                  <p className="font-medium hover:underline">
                    {row.project_name || "Untitled request"}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {[row.requester_name ?? row.requester_email, row.project_types[0]]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </Link>
              </TableCell>
              <TableCell className="font-mono text-xs">
                {row.submitted_at ? formatIsoDate(row.submitted_at) : "·"}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {/* A request awaiting approval has no window yet: it opens on
                    approval, so "Closed" would be a lie either way. */}
                {row.display_status === "pending_review" ? (
                  <span className="text-zinc-500 dark:text-zinc-400">Starts on approval</span>
                ) : row.quote_deadline ? (
                  row.display_status === "collecting" ? (
                    <span>
                      {formatIsoDate(row.quote_deadline)}{" "}
                      <CountdownChip deadline={row.quote_deadline} className="text-xs" />
                    </span>
                  ) : (
                    <span className="text-zinc-500 dark:text-zinc-400">Closed</span>
                  )
                ) : (
                  "·"
                )}
              </TableCell>
              <TableCell className="tabular-nums">{row.quote_count}</TableCell>
              <TableCell className="font-mono text-xs">
                {row.quote_price_range
                  ? formatQuoteRange(row.quote_price_range.min, row.quote_price_range.max)
                  : "·"}
              </TableCell>
              <TableCell>
                <StatusBadge status={row.display_status} />
              </TableCell>
              <TableCell className="text-sm">
                <SubsidyCell row={row} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
