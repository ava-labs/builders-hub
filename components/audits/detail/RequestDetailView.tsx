"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DEPLOYMENT_TARGET_LABELS } from "@/lib/audits/constants";
import type { DeploymentTarget } from "@/lib/audits/status";
import type { OwnerRequestDetail } from "@/server/services/audits/visibility";
import { StatusBadge } from "@/components/audits/shared/StatusBadge";
import { CountdownChip } from "@/components/audits/shared/CountdownChip";
import { formatIsoDate, formatUsd } from "@/components/audits/shared/format";
import { QuotesPanel } from "@/components/audits/quotes/QuotesPanel";

function metaStrip(detail: OwnerRequestDetail): string {
  const parts = [
    ...(detail.services.length > 0 ? [detail.services[0]] : []),
    ...(detail.nsloc ? [`~${detail.nsloc.toLocaleString("en-US")} nSLOC`] : []),
    ...(detail.deployment_target
      ? [DEPLOYMENT_TARGET_LABELS[detail.deployment_target as DeploymentTarget] ?? ""]
      : []),
    ...(detail.needed_by ? [`needed by ${formatIsoDate(detail.needed_by)}`] : []),
  ];
  return parts.filter(Boolean).join(" · ");
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

function WithdrawButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const withdraw = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/audits/requests/${requestId}/withdraw`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        toast.error(body?.message ?? "We couldn't withdraw this request.");
        return;
      }
      toast.success("Request withdrawn.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-zinc-500 hover:text-zinc-700">
          Withdraw request
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Withdraw this request?</AlertDialogTitle>
          <AlertDialogDescription>
            Firms will no longer be able to quote it, and it cannot be reopened. Quotes already
            received stay visible to you.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep collecting</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={() => void withdraw()}>
            Withdraw
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function StateCard({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-white/10 dark:bg-[#1F1F1F]">
      <p className="font-semibold">{title}</p>
      <p className="mt-1.5 text-sm text-zinc-600 dark:text-[#A2AFB2]">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function ReopenButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const reopen = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/audits/requests/${requestId}/reopen`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.success) {
        toast.error(body?.message ?? "We couldn't reopen this request.");
        return;
      }
      toast.success(`Reopened. ${body.auditorCount} firms were notified again.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" disabled={busy} onClick={() => void reopen()} className="h-11 md:h-10">
      Reopen for one more round
    </Button>
  );
}

export function RequestDetailView({
  detail,
  userId,
}: {
  detail: OwnerRequestDetail;
  userId: string;
}) {
  const status = detail.display_status;
  const acceptedQuote = detail.quotes.find((quote) => quote.status === "accepted") ?? null;
  const prices = detail.quotes.map((quote) => quote.price_usd);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        <Link href="/audits" className="hover:text-zinc-800 dark:hover:text-zinc-200">
          Audit requests
        </Link>{" "}
        / {detail.project_name || "Untitled request"}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {detail.project_name || "Untitled request"}
        </h1>
        <StatusBadge status={status} />
      </div>
      {metaStrip(detail) ? (
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          {metaStrip(detail)}
        </p>
      ) : null}

      <div className="mt-8 space-y-6">
        {status === "collecting" ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-[#1F1F1F]">
              <p className="text-sm">
                {detail.quote_deadline ? (
                  <>
                    <CountdownChip deadline={detail.quote_deadline} prefix="Window closes" />
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {" "}
                      · {formatIsoDate(detail.quote_deadline)}{" "}
                    </span>
                  </>
                ) : null}
                <span className="text-zinc-400 dark:text-zinc-500">| </span>
                <span className="font-medium">
                  {detail.quote_count} of {detail.fanout_count}
                </span>{" "}
                <span className="text-zinc-500 dark:text-zinc-400">firms have quoted</span>
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                Most quotes land in the final days
              </p>
            </div>
            {detail.quotes.length > 0 ? (
              <QuotesPanel
                quotes={detail.quotes}
                userId={userId}
                showAcceptNote
                acceptRequestId={detail.id}
              />
            ) : (
              <StateCard
                title="No quotes yet."
                body="Firms typically respond in the final days of the window. Quotes appear here as they arrive."
              />
            )}
            <div className="flex justify-end">
              <WithdrawButton requestId={detail.id} />
            </div>
          </>
        ) : null}

        {status === "deciding" ? (
          <>
            {prices.length > 0 ? (
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-300">
                {detail.quote_count} quotes · {formatUsd(Math.min(...prices))}–
                {formatUsd(Math.max(...prices))} · median {formatUsd(median(prices))}
              </p>
            ) : null}
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Window closed{detail.quote_deadline ? ` ${formatIsoDate(detail.quote_deadline)}` : ""}{" "}
              · quotes visible only to you and program admins
            </p>
            <QuotesPanel
              quotes={detail.quotes}
              userId={userId}
              showAcceptNote
              acceptRequestId={detail.id}
            />
          </>
        ) : null}

        {status === "engaged" ? (
          <>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
              <p className="font-semibold">
                Engaged{acceptedQuote ? ` ${acceptedQuote.firm_name}` : ""}
                {detail.closed_at ? ` on ${formatIsoDate(detail.closed_at)}` : ""}.
              </p>
              <p className="mt-1.5 text-sm text-zinc-600 dark:text-[#A2AFB2]">
                Continues off-platform under standardized terms.
              </p>
              {acceptedQuote?.quote_email ? (
                <p className="mt-3 text-sm">
                  Contact:{" "}
                  <a
                    className="font-medium underline underline-offset-2"
                    href={`mailto:${acceptedQuote.quote_email}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {acceptedQuote.quote_email}
                  </a>
                </p>
              ) : null}
            </div>
            {detail.subsidy ? (
              <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-white/10 dark:bg-[#1F1F1F]">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  Subsidy outcome
                </p>
                {detail.subsidy.state === "approved" ? (
                  <p className="mt-2 text-sm">
                    The program pays{" "}
                    <span className="font-semibold">{detail.subsidy.pct}%</span> (
                    {formatUsd(detail.subsidy.program_amount_usd)}) · you pay{" "}
                    <span className="font-semibold">
                      {formatUsd(detail.subsidy.project_amount_usd)}
                    </span>
                    .
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-zinc-600 dark:text-[#A2AFB2]">
                    A subsidy was not approved for this engagement.
                  </p>
                )}
              </div>
            ) : null}
            {detail.quotes.length > 0 ? (
              <QuotesPanel quotes={detail.quotes} userId={userId} />
            ) : null}
          </>
        ) : null}

        {status === "expired" ? (
          <StateCard
            title="The quote window closed without quotes."
            body="This request can be reopened for one more round; every active firm is notified again."
            action={<ReopenButton requestId={detail.id} />}
          />
        ) : null}

        {status === "withdrawn" ? (
          <StateCard
            title="You withdrew this request."
            body="Firms can no longer quote it. Start a new request any time."
          />
        ) : null}
      </div>
    </div>
  );
}
