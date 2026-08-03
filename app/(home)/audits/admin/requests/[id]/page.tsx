import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/prisma/prisma";
import { getAdminRequestDetail } from "@/server/services/audits/visibility";
import { StatusBadge } from "@/components/audits/shared/StatusBadge";
import { MONO_LABEL, MONO_LABEL_SM } from "@/components/audits/shared/classes";
import { formatIsoDate } from "@/components/audits/shared/format";
import { QuoteComparison } from "@/components/audits/admin/QuoteComparison";
import { SubsidyWorksheet } from "@/components/audits/admin/SubsidyWorksheet";
import { ReviewDecision } from "@/components/audits/admin/ReviewDecision";
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
  // Pending requests have no delivery rows yet, so the panel counts the
  // firms that WOULD be notified rather than the ones already notified.
  const activeAuditorCount =
    detail.display_status === "pending_review"
      ? await prisma.auditor.count({ where: { active: true } })
      : 0;

  return (
    <div className="mt-6">
      <p className={MONO_LABEL}>
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
          <StatusBadge
            status="deciding"
            label="Project picked"
            suffix={`· ${accepted.firm_name}`}
          />
        ) : (
          <StatusBadge status={detail.display_status} />
        )}
      </div>
      {failedSends.length > 0 ? (
        <p className="mt-1.5 text-sm text-amber-700 dark:text-amber-400">
          {failedSends.length} fan-out email{failedSends.length === 1 ? "" : "s"} failed:{" "}
          {failedSends.map((delivery) => delivery.auditor.firm_name).join(", ")}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <QuoteComparison
            quotes={detail.quotes}
            fanoutCount={detail.fanout_deliveries.length}
            submittedAt={detail.submitted_at}
            quoteDeadline={detail.quote_deadline}
            displayStatus={detail.display_status}
            neededBy={detail.needed_by}
          />

          <div className="rounded-xl border border-zinc-200 p-5 text-sm dark:border-white/10">
            <p className={MONO_LABEL_SM}>Scope</p>
            <p className="mt-2 whitespace-pre-line text-zinc-700 dark:text-zinc-300">
              {detail.scope || "·"}
            </p>
            <p className={`${MONO_LABEL_SM} mt-4`}>Contact</p>
            <p className="mt-1 text-zinc-700 dark:text-zinc-300">
              {[detail.contact_name, detail.contact_email, detail.contact_handle]
                .filter(Boolean)
                .join(" · ") || "·"}
            </p>
          </div>

          <ActivityTrail
            events={detail.events}
            fanoutFirms={detail.fanout_deliveries.map((delivery) => delivery.auditor.firm_name)}
            pendingDecision={Boolean(accepted) && !latestDecision}
          />
        </div>

        <div>
          {detail.display_status === "pending_review" ? (
            <ReviewDecision requestId={detail.id} fanoutTarget={activeAuditorCount} />
          ) : accepted ? (
            <SubsidyWorksheet
              requestId={detail.id}
              firmName={accepted.firm_name}
              priceUsd={accepted.price_usd}
              latest={
                latestDecision
                  ? {
                      state: latestDecision.state,
                      pct: latestDecision.pct,
                      program_amount_usd: latestDecision.program_amount_usd,
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
