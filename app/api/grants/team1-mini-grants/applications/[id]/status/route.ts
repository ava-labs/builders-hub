import { NextResponse } from "next/server";
import { withAuth, type RouteParams } from "@/lib/protectedRoute";
import { prisma } from "@/prisma/prisma";
import { deriveStatus } from "@/lib/grants/status";
import { MINI_GRANT_KEY } from "@/lib/grants/programs";

type Params = RouteParams<{ id: string }>;

// Read a single application's effective status. The status is derived from the
// review outcome (FormData.final_verdict + evaluation count) — there is no
// separate write/decision step; the devrel decides via the evaluate dashboard's
// final verdict (POST /api/evaluate/final-verdict).
export const GET = withAuth<Params>(async (_req, ctx, session) => {
  const { id } = await ctx.params;
  const app = await prisma.grantApplication.findUnique({
    where: { id },
    select: { project_id: true, user_id: true },
  });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only the applicant, a confirmed project member, or a reviewer/devrel may read status.
  const attrs = session.user?.custom_attributes ?? [];
  let authorized = attrs.includes("devrel") || attrs.includes("judge") || session.user?.id === app.user_id;
  if (!authorized) {
    const membership = await prisma.member.findFirst({
      where: { project_id: app.project_id, user_id: session.user?.id, status: "Confirmed" },
      select: { id: true },
    });
    authorized = membership !== null;
  }
  if (!authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Scope to this program's review: count only evaluations attached to the
  // mini-grant FormData, not every evaluation the project has ever received.
  const formData = await prisma.formData.findFirst({
    where: { project_id: app.project_id, origin: MINI_GRANT_KEY },
    select: { id: true, final_verdict: true },
  });
  const evaluationCount = formData
    ? await prisma.evaluation.count({ where: { form_data_id: formData.id } })
    : 0;

  return NextResponse.json({ status: deriveStatus(formData?.final_verdict ?? null, evaluationCount) });
});
