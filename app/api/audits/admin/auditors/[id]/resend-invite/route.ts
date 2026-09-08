import { NextRequest, NextResponse } from "next/server";
import type { RouteParams } from "@/lib/protectedRoute";
import { resendAuditorInvite } from "@/server/services/audits/auditors";
import { applyRateLimit, DAY_MS, requireAuditAdmin } from "@/app/api/audits/utils";

export async function POST(_request: NextRequest, context: RouteParams<{ id: string }>) {
  const { admin, error } = await requireAuditAdmin();
  if (error) return error;
  const limited = applyRateLimit("auditor-invite", admin.email, {
    windowMs: DAY_MS,
    maxRequests: 20,
  });
  if (limited) return limited;
  const { id } = await context.params;

  try {
    const result = await resendAuditorInvite(id, { id: admin.userId, name: admin.name });
    if (!result.success) {
      return NextResponse.json({ success: false, message: "Firm not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, inviteSent: result.inviteSent });
  } catch (err) {
    console.error("[Audits] invite resend failed:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't resend the invite right now." },
      { status: 500 },
    );
  }
}
