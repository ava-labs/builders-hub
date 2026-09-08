import { NextRequest, NextResponse } from "next/server";
import type { RouteParams } from "@/lib/protectedRoute";
import { submitRequestForReview } from "@/server/services/audits/fanout";
import { submitRequestSchema } from "@/types/audits";
import { applyRateLimit, DAY_MS, requireProjectUser } from "@/app/api/audits/utils";

export async function POST(request: NextRequest, context: RouteParams<{ id: string }>) {
  const { caller, error } = await requireProjectUser();
  if (error) return error;
  const limited = applyRateLimit("submit", caller.email, {
    windowMs: DAY_MS,
    maxRequests: 10,
  });
  if (limited) return limited;
  const { id } = await context.params;

  // The checkbox in the wizard is the affordance; this is the gate. Consent
  // must travel with the submission or nothing is sent.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const consent = submitRequestSchema.safeParse(body);
  if (!consent.success) {
    return NextResponse.json(
      {
        success: false,
        message: "Confirm that your contact details can be shared with the audit firms.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await submitRequestForReview(id, caller.userId);
    if (!result.success && result.code === "not_found") {
      return NextResponse.json(
        { success: false, message: "Draft not found or already submitted." },
        { status: 404 },
      );
    }
    if (!result.success) {
      return NextResponse.json(
        { success: false, message: "The request is not complete yet.", errors: result.errors },
        { status: 400 },
      );
    }
    // No counts to report: nothing has been sent to anyone yet, the request
    // is queued for admin review.
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Audits] submit failed:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't submit your request right now." },
      { status: 500 },
    );
  }
}
