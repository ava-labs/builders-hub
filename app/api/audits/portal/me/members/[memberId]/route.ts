import { NextResponse } from "next/server";
import type { RouteParams } from "@/lib/protectedRoute";
import { withAuditor, isFirmOwner } from "@/app/api/audits/portal/utils";
import { applyRateLimit, DAY_MS } from "@/app/api/audits/utils";
import { removeAuditorMember } from "@/server/services/audits/members";

/** Revoke a teammate's access, from the portal. Owner-gated (S-16). */
export const DELETE = withAuditor<RouteParams<{ memberId: string }>>(
  async (_request, context, auditor, actorEmail) => {
    const limited = applyRateLimit("firm-member-remove", auditor.quote_email, {
      windowMs: DAY_MS,
      maxRequests: 50,
    });
    if (limited) return limited;
    if (!isFirmOwner(auditor, actorEmail)) {
      return NextResponse.json(
        { success: false, message: "Only the firm's quote email can manage teammates." },
        { status: 403 },
      );
    }
    const { memberId } = await context.params;

    try {
      const result = await removeAuditorMember(auditor.id, memberId, {
        type: "auditor",
        id: auditor.id,
        email: actorEmail,
      });
      if (!result.success) {
        return NextResponse.json(
          { success: false, message: "Email not found on this firm." },
          { status: 404 },
        );
      }
      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("[Audits] portal teammate remove failed:", err);
      return NextResponse.json(
        { success: false, message: "We couldn't remove this email right now." },
        { status: 500 },
      );
    }
  },
);
