import { NextRequest, NextResponse } from "next/server";
import type { RouteParams } from "@/lib/protectedRoute";
import { auditorUpdateSchema } from "@/types/audits";
import { updateAuditor } from "@/server/services/audits/auditors";
import { applyRateLimit, DAY_MS, requireAuditAdmin } from "@/app/api/audits/utils";

export async function PATCH(request: NextRequest, context: RouteParams<{ id: string }>) {
  const { admin, error } = await requireAuditAdmin();
  if (error) return error;
  const limited = applyRateLimit("auditor-update", admin.email, {
    windowMs: DAY_MS,
    maxRequests: 50,
  });
  if (limited) return limited;
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid body" }, { status: 400 });
  }

  const parsed = auditorUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const result = await updateAuditor(id, parsed.data, { id: admin.userId, name: admin.name });
    if (!result.success) {
      return NextResponse.json({ success: false, message: "Firm not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, auditor: result.auditor });
  } catch (err) {
    console.error("[Audits] auditor update failed:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't update this firm right now." },
      { status: 500 },
    );
  }
}
