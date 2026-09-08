import { NextRequest, NextResponse } from "next/server";
import type { RouteParams } from "@/lib/protectedRoute";
import { returnToDraft } from "@/server/services/audits/requests";
import { applyRateLimit, DAY_MS, requireProjectUser } from "@/app/api/audits/utils";

/**
 * Cancel a pending review and go back to editing. Only ever valid while the
 * request is still awaiting approval, which the service pins in its where
 * clause: once fan-out has happened, withdraw is the exit instead.
 */
export async function POST(_request: NextRequest, context: RouteParams<{ id: string }>) {
  const { caller, error } = await requireProjectUser();
  if (error) return error;
  const limited = applyRateLimit("return-to-draft", caller.email, {
    windowMs: DAY_MS,
    maxRequests: 20,
  });
  if (limited) return limited;
  const { id } = await context.params;

  try {
    const result = await returnToDraft(caller.userId, id);
    if (!result.success) {
      return NextResponse.json(
        { success: false, message: "This request is no longer awaiting approval." },
        { status: 409 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Audits] return to draft failed:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't reopen this request for editing right now." },
      { status: 500 },
    );
  }
}
