import { NextResponse } from "next/server";
import type { Session } from "next-auth";

import { withAuth } from "@/lib/protectedRoute";
import { canAccessBuilderInsights } from "@/lib/auth/permissions";
import { getBuilderInsightsData } from "@/server/services/builderInsights";

// PostHog HogQL queries inside getBuilderInsightsData fluctuate by definition
// (they're rolling windows). Opt out of route caching so DevRel always sees
// fresh data each time the Insights tab is opened.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = withAuth(async (_request, _context: unknown, session: Session) => {
  const userId = session.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!canAccessBuilderInsights(session.user?.custom_attributes)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const data = await getBuilderInsightsData(userId);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[profile/insights] error:", err);
    return NextResponse.json(
      { error: "Failed to load builder insights" },
      { status: 500 },
    );
  }
});
