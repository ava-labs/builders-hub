import { NextResponse } from "next/server";
import { getAdminRequests } from "@/server/services/audits/visibility";
import { toCsv } from "@/server/services/audits/csv";
import { requireAuditAdmin } from "@/app/api/audits/utils";

/** Admin-only CSV export of every request (paged reads, 500-row safety cap). */
export async function GET() {
  const { error } = await requireAuditAdmin();
  if (error) return error;

  try {
    const all = [];
    for (let skip = 0; skip < 500; skip += 100) {
      const page = await getAdminRequests({ take: 100, skip });
      all.push(...page);
      if (page.length < 100) break;
    }

    const csv = toCsv(
      [
        "request",
        "requester",
        "requester_email",
        "submitted",
        "quote_deadline",
        "status",
        "quotes",
        "price_min_usd",
        "price_max_usd",
        "subsidy_state",
        "subsidy_amount_usd",
        "subsidy_pct",
        "accepted_price_usd",
        "firms_notified",
      ],
      all.map((row) => [
        row.project_name,
        row.requester_name,
        row.requester_email,
        row.submitted_at,
        row.quote_deadline,
        row.display_status,
        row.quote_count,
        row.quote_price_range?.min ?? null,
        row.quote_price_range?.max ?? null,
        row.subsidy_state,
        row.subsidy_amount_usd,
        row.subsidy_pct,
        row.accepted_firm_price_usd,
        row.fanout_count,
      ]),
    );

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-requests-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err) {
    console.error("[Audits] requests export failed:", err);
    return NextResponse.json({ success: false, message: "Export failed." }, { status: 500 });
  }
}
