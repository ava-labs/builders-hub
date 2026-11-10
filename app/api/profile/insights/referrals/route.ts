import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { z } from "zod";

import { withAuth } from "@/lib/protectedRoute";
import { canAccessBuilderInsights } from "@/lib/auth/permissions";
import { getReferralsForPeriod } from "@/server/services/builderInsights";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const querySchema = z.object({
  // "2026-11-15" (a day) or "2026-11" (a month).
  period: z
    .string()
    .regex(
      /^\d{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$/,
      "Expected YYYY-MM-DD or YYYY-MM",
    ),
  // IANA zone the period is meant in — an event on "the 15th" is the 15th
  // where the event happened. Unknown zones fall back to UTC in the service.
  tz: z.string().max(64).default("UTC"),
});

export const GET = withAuth(async (request, _context: unknown, session: Session) => {
  if (!canAccessBuilderInsights(session.user?.custom_attributes)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    period: params.get("period"),
    tz: params.get("tz") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await getReferralsForPeriod(parsed.data.period, parsed.data.tz),
    );
  } catch (err) {
    console.error("[profile/insights/referrals] error:", err);
    return NextResponse.json(
      { error: "Failed to load referrals for that period" },
      { status: 500 },
    );
  }
});
