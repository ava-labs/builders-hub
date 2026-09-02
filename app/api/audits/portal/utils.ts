import { NextRequest, NextResponse } from "next/server";
import type { Auditor } from "@prisma/client";
import { getAuthSession } from "@/lib/auth/authSession";
import { resolveAuditorByEmail } from "@/server/services/audits/auditors";

/**
 * The auditor portal's gate: any signed-in session whose email is an ACTIVE
 * whitelist row. pending_ sessions (OTP sign-in without a Builder Hub User
 * row) are the intended mechanism: auditors have no accounts. The Auditor
 * row rides into the handler; first_login_at is stamped by the resolver.
 * allowInactive opens READ routes to deactivated firms (round-3 N-4: their
 * history stays visible); writes never pass it. `actorEmail` is the signed-in
 * address itself (quote email or approved teammate) for attribution; the
 * Auditor row is the firm.
 */
export function withAuditor<TContext = unknown>(
  handler: (
    request: NextRequest,
    context: TContext,
    auditor: Auditor,
    actorEmail: string,
  ) => Promise<NextResponse>,
  options: { allowInactive?: boolean } = {},
) {
  return async function (request: NextRequest, context: TContext) {
    const session = await getAuthSession();
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json(
        { success: false, message: "Sign in with your firm's quote email." },
        { status: 401 },
      );
    }
    const auditor = await resolveAuditorByEmail(email);
    if (!auditor) {
      return NextResponse.json(
        { success: false, message: "This email is not on the audit whitelist." },
        { status: 403 },
      );
    }
    if (!auditor.active && !options.allowInactive) {
      return NextResponse.json(
        { success: false, message: "This firm is deactivated. Contact the program team." },
        { status: 403 },
      );
    }
    return handler(request, context, auditor, email);
  };
}
