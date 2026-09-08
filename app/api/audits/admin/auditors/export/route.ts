import { NextResponse } from "next/server";
import { getAdminAuditors } from "@/server/services/audits/visibility";
import { getAuditorStatusHistory } from "@/server/services/audits/auditors";
import { toCsv } from "@/server/services/audits/csv";
import { requireAuditAdmin } from "@/app/api/audits/utils";

/** Admin-only CSV export of the whitelist, with the activation history. */
export async function GET() {
  const { error } = await requireAuditAdmin();
  if (error) return error;

  try {
    const [auditors, history] = await Promise.all([
      getAdminAuditors(),
      getAuditorStatusHistory(),
    ]);

    const csv = toCsv(
      [
        "firm",
        "quote_email",
        "team_emails",
        "services",
        "status",
        "invited_at",
        "first_login_at",
        "deactivated_at",
        "fanouts_sent",
        "quoted",
        "won",
        "last_quote_at",
        "attio_ref",
        "status_history",
      ],
      auditors.map((auditor) => [
        auditor.firm_name,
        auditor.quote_email,
        auditor.members.map((member) => member.email).join("; "),
        auditor.services.join("; "),
        auditor.active ? (auditor.first_login_at ? "active" : "invited") : "inactive",
        auditor.invited_at,
        auditor.first_login_at,
        auditor.deactivated_at,
        auditor.sent,
        auditor.quoted,
        auditor.won,
        auditor.last_quote_at,
        auditor.attio_ref,
        (history.get(auditor.firm_name) ?? []).join("; "),
      ]),
    );

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-whitelist-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err) {
    console.error("[Audits] whitelist export failed:", err);
    return NextResponse.json({ success: false, message: "Export failed." }, { status: 500 });
  }
}
