import { NextRequest, NextResponse } from "next/server";
import type { RouteParams } from "@/lib/protectedRoute";
import { reopen } from "@/server/services/audits/requests";
import { applyRateLimit, DAY_MS, requireProjectUser } from "@/app/api/audits/utils";

export async function POST(_request: NextRequest, context: RouteParams<{ id: string }>) {
  const { caller, error } = await requireProjectUser();
  if (error) return error;
  const limited = applyRateLimit("reopen", caller.email, { windowMs: DAY_MS, maxRequests: 5 });
  if (limited) return limited;
  const { id } = await context.params;

  try {
    const result = await reopen(caller.userId, id);
    if (!result.success && result.code === "not_found") {
      return NextResponse.json({ success: false, message: "Request not found." }, { status: 404 });
    }
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message:
            result.code === "already_reopened"
              ? "This request already had its extra round."
              : "Only an expired request with no quotes can be reopened.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json({
      success: true,
      auditorCount: result.auditorCount,
      emailFailures: result.emailFailures,
    });
  } catch (err) {
    console.error("[Audits] reopen failed:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't reopen this request right now." },
      { status: 500 },
    );
  }
}
