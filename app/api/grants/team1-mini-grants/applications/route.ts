import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/authSession";
import { prisma } from "@/prisma/prisma";
import { MINI_GRANT_KEY } from "@/lib/grants/programs";
import { deriveStatus } from "@/lib/grants/status";

// List the signed-in user's applications for this program (for the apply page +
// landing page "your applications" views).
export async function GET() {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId || userId.startsWith("pending_")) {
    return NextResponse.json({ applications: [] });
  }

  const apps = await prisma.grantApplication.findMany({
    where: { program_key: MINI_GRANT_KEY, user_id: userId },
    select: {
      id: true,
      project_id: true,
      created_at: true,
      project: { select: { project_name: true } },
    },
    orderBy: { created_at: "desc" },
  });

  const projectIds = apps.map((a) => a.project_id);
  // Scope status to THIS program's review. The mini-grant has exactly one FormData
  // (origin = MINI_GRANT_KEY) per project, and its evaluations attach to that
  // FormData; counting evaluations by project_id would also pick up unrelated
  // reviews from other flows, wrongly flipping a fresh application to under_review.
  const formDatas = projectIds.length
    ? await prisma.formData.findMany({
        where: { origin: MINI_GRANT_KEY, project_id: { in: projectIds } },
        select: { id: true, project_id: true, final_verdict: true },
      })
    : [];
  const fdByProject = new Map(formDatas.map((f) => [f.project_id, f]));
  const formDataIds = formDatas.map((f) => f.id);
  const counts = formDataIds.length
    ? await prisma.evaluation.groupBy({
        by: ["form_data_id"],
        where: { form_data_id: { in: formDataIds } },
        _count: { _all: true },
      })
    : [];
  const countByFormData = new Map(counts.map((c) => [c.form_data_id, c._count._all]));

  const applications = apps.map((a) => {
    const fd = fdByProject.get(a.project_id);
    return {
      id: a.id,
      projectId: a.project_id,
      projectName: a.project?.project_name ?? "Untitled Project",
      status: deriveStatus(
        fd?.final_verdict ?? null,
        fd ? countByFormData.get(fd.id) ?? 0 : 0,
      ),
      createdAt: a.created_at,
    };
  });

  return NextResponse.json({ applications });
}
