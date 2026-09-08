import { NextRequest, NextResponse } from "next/server";
import type { RouteParams } from "@/lib/protectedRoute";
import { AUDITOR_MEMBER_LIMIT } from "@/lib/audits/constants";
import { auditorMemberCreateSchema } from "@/types/audits";
import { addAuditorMember } from "@/server/services/audits/members";
import { applyRateLimit, DAY_MS, requireAuditAdmin } from "@/app/api/audits/utils";

/** Approve one more sign-in address for a firm and send it the OTP invite. */
export async function POST(request: NextRequest, context: RouteParams<{ id: string }>) {
  const { admin, error } = await requireAuditAdmin();
  if (error) return error;
  const limited = applyRateLimit("auditor-member-add", admin.email, {
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

  const parsed = auditorMemberCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const result = await addAuditorMember(id, parsed.data, { id: admin.userId, name: admin.name });
    if (!result.success && result.code === "not_found") {
      return NextResponse.json({ success: false, message: "Firm not found." }, { status: 404 });
    }
    if (!result.success && result.code === "limit_reached") {
      return NextResponse.json(
        {
          success: false,
          message: `A firm can have up to ${AUDITOR_MEMBER_LIMIT} approved emails.`,
        },
        { status: 409 },
      );
    }
    if (!result.success) {
      return NextResponse.json(
        { success: false, message: "This email is already on the whitelist." },
        { status: 409 },
      );
    }
    // Only what the panel renders; added_by and the rest stay server-side.
    const { id: memberId, email, invited_at, first_login_at } = result.member;
    return NextResponse.json(
      {
        success: true,
        member: { id: memberId, email, invited_at, first_login_at },
        inviteSent: result.inviteSent,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[Audits] teammate add failed:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't add this email right now." },
      { status: 500 },
    );
  }
}
