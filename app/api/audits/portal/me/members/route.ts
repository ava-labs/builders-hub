import { NextResponse } from "next/server";
import { withAuditor, isFirmOwner } from "@/app/api/audits/portal/utils";
import { applyRateLimit, DAY_MS } from "@/app/api/audits/utils";
import { AUDITOR_MEMBER_LIMIT } from "@/lib/audits/constants";
import { auditorMemberCreateSchema } from "@/types/audits";
import { addAuditorMember } from "@/server/services/audits/members";

/**
 * Approve one more sign-in address for the firm, from the portal. Owner-gated:
 * only the quote-email identity manages the team (S-16). The service sends the
 * S-2 notice to the quote email and stores added_by null for a portal add.
 */
export const POST = withAuditor(async (request, _context, auditor, actorEmail) => {
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return NextResponse.json({ success: false, message: "Send JSON." }, { status: 415 });
  }
  const limited = applyRateLimit("firm-member-add", auditor.quote_email, {
    windowMs: DAY_MS,
    maxRequests: 10,
  });
  if (limited) return limited;
  if (!isFirmOwner(auditor, actorEmail)) {
    return NextResponse.json(
      { success: false, message: "Only the firm's quote email can manage teammates." },
      { status: 403 },
    );
  }

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
    const result = await addAuditorMember(auditor.id, parsed.data, {
      type: "auditor",
      id: auditor.id,
      email: actorEmail,
    });
    if (!result.success && result.code === "not_found") {
      return NextResponse.json({ success: false, message: "Firm not found." }, { status: 404 });
    }
    if (!result.success && result.code === "limit_reached") {
      return NextResponse.json(
        { success: false, message: `A firm can have up to ${AUDITOR_MEMBER_LIMIT} approved emails.` },
        { status: 409 },
      );
    }
    if (!result.success) {
      return NextResponse.json(
        { success: false, message: "This email can't be added to your firm." },
        { status: 409 },
      );
    }
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
    console.error("[Audits] portal teammate add failed:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't add this email right now." },
      { status: 500 },
    );
  }
});
