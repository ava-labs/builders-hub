import { NextRequest, NextResponse } from "next/server";
import type { RouteParams } from "@/lib/protectedRoute";
import { startAgain } from "@/server/services/audits/requests";
import { applyRateLimit, DAY_MS, requireProjectUser } from "@/app/api/audits/utils";

/**
 * A new round for a lapsed request: a copy as a new draft, which the client
 * opens in the wizard. Each call makes one more draft, so it spends the same
 * rate limit bucket as creating one.
 */
export async function POST(_request: NextRequest, context: RouteParams<{ id: string }>) {
  const { caller, error } = await requireProjectUser();
  if (error) return error;
  const limited = applyRateLimit("draft-create", caller.email, {
    windowMs: DAY_MS,
    maxRequests: 20,
  });
  if (limited) return limited;
  const { id } = await context.params;

  try {
    const result = await startAgain(caller.userId, id);
    if (!result.success && result.code === "not_found") {
      return NextResponse.json({ success: false, message: "Request not found." }, { status: 404 });
    }
    if (!result.success) {
      return NextResponse.json(
        { success: false, message: "Only an expired request with quotes can be started again." },
        { status: 409 },
      );
    }
    return NextResponse.json({ success: true, id: result.id }, { status: 201 });
  } catch (err) {
    console.error("[Audits] start again failed:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't start this request again right now." },
      { status: 500 },
    );
  }
}
