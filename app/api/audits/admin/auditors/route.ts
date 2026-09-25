import { NextRequest, NextResponse } from "next/server";
import { auditorCreateSchema } from "@/types/audits";
import { createAuditor } from "@/server/services/audits/auditors";
import { getAdminAuditors } from "@/server/services/audits/visibility";
import { applyRateLimit, DAY_MS, requireAuditAdmin } from "@/app/api/audits/utils";

export async function GET() {
  const { error } = await requireAuditAdmin();
  if (error) return error;

  try {
    const auditors = await getAdminAuditors();
    return NextResponse.json({ success: true, auditors });
  } catch (err) {
    console.error("[Audits] whitelist load failed:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't load the whitelist right now." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const { admin, error } = await requireAuditAdmin();
  if (error) return error;
  const limited = applyRateLimit("auditor-add", admin.email, {
    windowMs: DAY_MS,
    maxRequests: 30,
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Invalid body" }, { status: 400 });
  }

  const parsed = auditorCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const result = await createAuditor(parsed.data, { id: admin.userId, name: admin.name });
    if (!result.success) {
      return NextResponse.json(
        { success: false, message: "A firm with this quote email is already on the whitelist." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { success: true, auditor: result.auditor, inviteSent: result.inviteSent },
      { status: 201 },
    );
  } catch (err) {
    console.error("[Audits] auditor add failed:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't add this firm right now." },
      { status: 500 },
    );
  }
}
