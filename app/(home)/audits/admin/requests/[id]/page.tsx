import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminRequestDetail } from "@/server/services/audits/visibility";
import { StatusBadge } from "@/components/audits/shared/StatusBadge";
import { formatIsoDate } from "@/components/audits/shared/format";
import { QuoteComparison } from "@/components/audits/admin/QuoteComparison";
import { SubsidyWorksheet } from "@/components/audits/admin/SubsidyWorksheet";
import { ActivityTrail } from "@/components/audits/admin/ActivityTrail";

export default async function AuditAdminDrilldownPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getAdminRequestDetail(id);
  if (!detail) notFound();

  const accepted = detail.quotes.find((quote) => quote.status === "accepted") ?? null;
  const failedSends = detail.fanout_deliveries.filter(
    (delivery) => delivery.email_status === "failed",
  );
  const latestDecision = detail.subsidy_decisions[0] ?? null;

  return (
    <div className="mt-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        <Link href="/audits/admin" className="hover:text-zinc-800 dark:hover:text-zinc-200">
          Audit program
        </Link>{" "}
        / {detail.project_name || "Untitled request"}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">
          {detail.project_name || "Untitled request"}
        </h2>
        {accepted ? (
          <p className="text-sm font-medium">Project picked · {accepted.firm_name}</p>
        ) : (
          <StatusBadge status={detail.display_status} />
        )}
      </div>
      <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
        Quotes · {detail.quotes.length} of {detail.fanout_deliveries.length} firms responded
        {detail.submitted_at ? ` · fan-out ${formatIsoDate(detail.submitted_at)}` : ""}
        {detail.quote_deadline
          ? ` · window ${detail.display_status === "collecting" ? "closes" : "closed"} ${formatIsoDate(detail.quote_deadline)}`
          : ""}
      </p>
      {failedSends.length > 0 ? (
        <p className="mt-1.5 text-sm text-brand dark:text-brand-soft">
          {failedSends.length} fan-out email{failedSends.length === 1 ? "" : "s"} failed:{" "}
          {failedSends.map((delivery) => delivery.auditor.firm_name).join(", ")}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <QuoteComparison quotes={detail.quotes} />

          <div className="rounded-xl border border-zinc-200 p-5 text-sm dark:border-white/10">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              Scope
            </p>
            <p className="mt-2 whitespace-pre-line text-zinc-700 dark:text-zinc-300">
              {detail.scope || "·"}
            </p>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              Contact
            </p>
            <p className="mt-1 text-zinc-700 dark:text-zinc-300">
              {[detail.contact_name, detail.contact_email, detail.contact_handle]
                .filter(Boolean)
                .join(" · ") || "·"}
            </p>
          </div>

          <ActivityTrail events={detail.events} />
        </div>

        <div>
          {accepted ? (
            <SubsidyWorksheet
              requestId={detail.id}
              firmName={accepted.firm_name}
              priceUsd={accepted.price_usd}
              latest={
                latestDecision
                  ? {
                      state: latestDecision.state,
                      pct: latestDecision.pct,
                      decided_at: latestDecision.decided_at,
                    }
                  : null
              }
            />
          ) : (
            <div className="rounded-xl border border-zinc-200 p-5 text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
              The subsidy worksheet unlocks once the project accepts a quote.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
