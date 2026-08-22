import { NextRequest, NextResponse } from "next/server";
import type { RouteParams } from "@/lib/protectedRoute";
import { acceptQuoteSchema } from "@/types/audits";
import { acceptQuote } from "@/server/services/audits/acceptance";
import { applyRateLimit, DAY_MS, requireProjectUser } from "@/app/api/audits/utils";

export async function POST(request: NextRequest, context: RouteParams<{ id: string }>) {
  const { caller, error } = await requireProjectUser();
  if (error) return error;
  const limited = applyRateLimit("accept", caller.email, { windowMs: DAY_MS, maxRequests: 10 });
  if (limited) return limited;
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid body" }, { status: 400 });
  }

  const parsed = acceptQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "quoteId is required" }, { status: 400 });
  }

  try {
    const result = await acceptQuote(id, parsed.data.quoteId, caller.userId);
    if (!result.success) {
      return NextResponse.json(
        { success: false, message: "This quote can no longer be accepted." },
        { status: 409 },
      );
    }
    return NextResponse.json({
      success: true,
      firm_name: result.firm_name,
      quote_email: result.quote_email,
    });
  } catch (err) {
    console.error("[Audits] accept failed:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't accept this quote right now." },
      { status: 500 },
    );
  }
}
