import { NextRequest, NextResponse } from "next/server";
import type { RouteParams } from "@/lib/protectedRoute";
import { requestReviewSchema } from "@/types/audits";
import { approveRequestAndFanout, rejectRequest } from "@/server/services/audits/fanout";
import { applyRateLimit, DAY_MS, requireAuditAdmin } from "@/app/api/audits/utils";

/**
 * The approval gate. Approving is the ONLY path that reaches an auditor:
 * submission parks a request in pending_review and nothing is emailed until
 * this route runs.
 */
export async function POST(request: NextRequest, context: RouteParams<{ id: string }>) {
  const { admin, error } = await requireAuditAdmin();
  if (error) return error;
  const limited = applyRateLimit("review", admin.email, { windowMs: DAY_MS, maxRequests: 100 });
  if (limited) return limited;
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid body" }, { status: 400 });
  }

  const parsed = requestReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    if (parsed.data.decision === "reject") {
      const rejected = await rejectRequest(id, admin.userId, admin.name, parsed.data.reason ?? "");
      if (!rejected.success) {
        return NextResponse.json(
          { success: false, message: "This request is no longer awaiting review." },
          { status: 409 },
        );
      }
      return NextResponse.json({ success: true });
    }

    const result = await approveRequestAndFanout(id, admin.userId, admin.name);
    if (!result.success) {
      return NextResponse.json(
        { success: false, message: "This request is no longer awaiting review." },
        { status: 409 },
      );
    }
    return NextResponse.json({
      success: true,
      auditorCount: result.auditorCount,
      emailFailures: result.emailFailures,
    });
  } catch (err) {
    console.error("[Audits] review decision failed:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't record the decision right now." },
      { status: 500 },
    );
  }
}
