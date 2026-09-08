import { NextRequest, NextResponse } from "next/server";
import type { RouteParams } from "@/lib/protectedRoute";
import { removeAuditorMember } from "@/server/services/audits/members";
import { applyRateLimit, DAY_MS, requireAuditAdmin } from "@/app/api/audits/utils";

/** Revoke a teammate's access; re-adding the address is the undo. */
export async function DELETE(
  _request: NextRequest,
  context: RouteParams<{ id: string; memberId: string }>,
) {
  const { admin, error } = await requireAuditAdmin();
  if (error) return error;
  const limited = applyRateLimit("auditor-member-remove", admin.email, {
    windowMs: DAY_MS,
    maxRequests: 50,
  });
  if (limited) return limited;
  const { id, memberId } = await context.params;

  try {
    const result = await removeAuditorMember(id, memberId, { id: admin.userId, name: admin.name });
    if (!result.success) {
      return NextResponse.json(
        { success: false, message: "Email not found on this firm." },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Audits] teammate remove failed:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't remove this email right now." },
      { status: 500 },
    );
  }
}
