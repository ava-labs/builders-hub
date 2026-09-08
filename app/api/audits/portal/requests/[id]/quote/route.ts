import { NextResponse } from "next/server";
import type { RouteParams } from "@/lib/protectedRoute";
import { auditQuoteSchema } from "@/types/audits";
import { upsertOwnQuote } from "@/server/services/audits/quotes";
import { applyRateLimit, DAY_MS } from "@/app/api/audits/utils";
import { withAuditor } from "@/app/api/audits/portal/utils";

export const PUT = withAuditor<RouteParams<{ id: string }>>(async (request, context, auditor, actorEmail) => {
  const limited = applyRateLimit("quote", auditor.quote_email, {
    windowMs: DAY_MS,
    maxRequests: 60,
  });
  if (limited) return limited;
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid body" }, { status: 400 });
  }

  const parsed = auditQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const result = await upsertOwnQuote(
      {
        id: auditor.id,
        firm_name: auditor.firm_name,
        active: auditor.active,
        actor_email: actorEmail,
      },
      id,
      parsed.data,
    );
    if (!result.success && result.code === "not_invited") {
      return NextResponse.json({ success: false, message: "Request not found." }, { status: 404 });
    }
    if (!result.success && result.code === "not_active") {
      return NextResponse.json(
        { success: false, message: "This firm is deactivated. Contact the program team." },
        { status: 403 },
      );
    }
    if (!result.success) {
      return NextResponse.json(
        { success: false, message: "The quote window for this request has closed." },
        { status: 409 },
      );
    }
    return NextResponse.json({ success: true, updated: result.updated });
  } catch (err) {
    console.error("[Audits] quote upsert failed:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't save your quote right now." },
      { status: 500 },
    );
  }
});
