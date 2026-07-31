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
import type { AdminRequestRow } from "@/server/services/audits/visibility";
import { StatusBadge } from "@/components/audits/shared/StatusBadge";
import { CountdownChip } from "@/components/audits/shared/CountdownChip";
import { formatIsoDate, formatUsd } from "@/components/audits/shared/format";

const kUsd = (value: number) => `$${Math.round(value / 1000)}k`;

function SubsidyCell({ row }: { row: AdminRequestRow }) {
  if (row.subsidy_state === "needs_approval") {
    return <span className="font-medium text-brand dark:text-brand-soft">Needs approval</span>;
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
          <TableRow>
            <TableHead>Request</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead>Quote ddl</TableHead>
            <TableHead>Quotes</TableHead>
            <TableHead>Range</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Subsidy</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={row.id}
              onClick={() => router.push(`/audits/admin/requests/${row.id}`)}
              className={cn(
                "cursor-pointer",
                row.subsidy_state === "needs_approval" && "bg-brand/5",
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
                {row.quote_deadline ? (
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
                  ? `${kUsd(row.quote_price_range.min)}–${kUsd(row.quote_price_range.max)}`
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
