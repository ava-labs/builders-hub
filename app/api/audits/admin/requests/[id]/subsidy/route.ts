import { NextRequest, NextResponse } from "next/server";
import type { RouteParams } from "@/lib/protectedRoute";
import { subsidyDecisionSchema } from "@/types/audits";
import { decideSubsidy } from "@/server/services/audits/subsidy";
import { applyRateLimit, DAY_MS, requireAuditAdmin } from "@/app/api/audits/utils";

export async function POST(request: NextRequest, context: RouteParams<{ id: string }>) {
  const { admin, error } = await requireAuditAdmin();
  if (error) return error;
  const limited = applyRateLimit("subsidy", admin.email, { windowMs: DAY_MS, maxRequests: 50 });
  if (limited) return limited;
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid body" }, { status: 400 });
  }

  // pct <= 75 is enforced HERE, server-side; the slider step is UI-only.
  const parsed = subsidyDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const result = await decideSubsidy(id, parsed.data, { id: admin.userId, name: admin.name });
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message:
            result.code === "over_cap"
              ? "The amount exceeds the 75% cap for this quote."
              : "Subsidy decisions need an engaged request with an accepted quote.",
        },
        { status: result.code === "over_cap" ? 400 : 409 },
      );
    }
    return NextResponse.json({ success: true, decision_id: result.decision_id });
  } catch (err) {
    console.error("[Audits] subsidy decision failed:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't record the decision right now." },
      { status: 500 },
    );
  }
}
