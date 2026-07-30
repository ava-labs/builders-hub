import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/authSession";
import { canAdministerAuditProgram } from "@/lib/auth/permissions";
import { checkRateLimit } from "@/lib/rateLimit";

export interface AuditCaller {
  userId: string;
  email: string;
}

type CallerResult = { caller: AuditCaller; error?: never } | { caller?: never; error: NextResponse };

/**
 * Session gate for the project portal. pending_ ids (OTP sign-in without a
 * User row) are rejected on writes exactly like mini-grants; reads that
 * scope by user_id may allow them since a pending_ id matches no rows.
 */
export async function requireProjectUser(options?: { allowPending?: boolean }): Promise<CallerResult> {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  const email = session?.user?.email?.trim().toLowerCase();
  if (!userId || !email) {
    return {
      error: NextResponse.json(
        { success: false, message: "Please sign in to manage audit requests." },
        { status: 401 },
      ),
    };
  }
  if (!options?.allowPending && userId.startsWith("pending_")) {
    return {
      error: NextResponse.json(
        { success: false, message: "Finish account setup first." },
        { status: 403 },
      ),
    };
  }
  return { caller: { userId, email } };
}

export interface AdminCaller {
  userId: string;
  email: string;
  /** Shown in subsidy-approval events; falls back to the email. */
  name: string;
}

type AdminResult = { admin: AdminCaller; error?: never } | { admin?: never; error: NextResponse };

/**
 * Gate for the audit-program admin routes: signed in AND audit_admin or
 * devrel in custom_attributes (withAuthRole takes a single role only, so the
 * check goes through canAdministerAuditProgram).
 */
export async function requireAuditAdmin(): Promise<AdminResult> {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  const email = session?.user?.email?.trim().toLowerCase();
  if (!userId || !email) {
    return {
      error: NextResponse.json(
        { success: false, message: "Please sign in." },
        { status: 401 },
      ),
    };
  }
  if (!canAdministerAuditProgram(session)) {
    return {
      error: NextResponse.json(
        { success: false, message: "Access denied.", requiredRole: "audit_admin" },
        { status: 403 },
      ),
    };
  }
  return { admin: { userId, email, name: session?.user?.name ?? email } };
}

/**
 * Per-caller in-memory rate limit (lib/rateLimit reality: per instance).
 * Used instead of the rateLimited() wrapper because dynamic-segment handlers
 * need their context argument, which that wrapper does not forward.
 */
export function applyRateLimit(
  area: string,
  email: string,
  options: { windowMs: number; maxRequests: number },
): NextResponse | null {
  if (process.env.NODE_ENV === "development") return null;
  const result = checkRateLimit(`audit:${area}:${email}`, options);
  if (result.allowed) return null;
  const minutes = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 60_000));
  return NextResponse.json(
    {
      success: false,
      message: `Rate limit reached. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    },
    { status: 429 },
  );
}

export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;
