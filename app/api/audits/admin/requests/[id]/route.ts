import { NextRequest, NextResponse } from "next/server";
import type { RouteParams } from "@/lib/protectedRoute";
import { getAdminRequestDetail } from "@/server/services/audits/visibility";
import { deleteRequest } from "@/server/services/audits/requests";
import { applyRateLimit, DAY_MS, requireAuditAdmin } from "@/app/api/audits/utils";

export async function GET(_request: NextRequest, context: RouteParams<{ id: string }>) {
  const { error } = await requireAuditAdmin();
  if (error) return error;
  const { id } = await context.params;

  try {
    const request = await getAdminRequestDetail(id);
    if (!request) {
      return NextResponse.json({ success: false, message: "Request not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, request });
  } catch (err) {
    console.error("[Audits] admin drill-down failed:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't load this request right now." },
      { status: 500 },
    );
  }
}

/**
 * Permanent delete. The confirmation dialog on the admin page is the human
 * double check; which statuses may go is the service's rule.
 */
export async function DELETE(_request: NextRequest, context: RouteParams<{ id: string }>) {
  const { admin, error } = await requireAuditAdmin();
  if (error) return error;
  const limited = applyRateLimit("request-delete", admin.email, {
    windowMs: DAY_MS,
    maxRequests: 50,
  });
  if (limited) return limited;
  const { id } = await context.params;

  try {
    const result = await deleteRequest(id, admin.userId, admin.name);
    if (!result.success) {
      return result.code === "not_found"
        ? NextResponse.json({ success: false, message: "Request not found." }, { status: 404 })
        : NextResponse.json(
            {
              success: false,
              message: "This request can no longer be deleted: a quote was accepted, or it just changed.",
            },
            { status: 409 },
          );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Audits] admin request delete failed:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't delete this request right now." },
      { status: 500 },
    );
  }
}
