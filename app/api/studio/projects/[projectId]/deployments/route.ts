import { proposeDeploymentSchema } from "@/types/studio";
import { prisma } from "@/prisma/prisma";
import { proposeDeployment, viewOf } from "@/server/services/studio/deployments";
import { getOwnedProject } from "@/server/services/studio/projects";
import { parseBody, studioRoute } from "../../../_lib/route";

export const runtime = "nodejs";

type Params = { projectId: string };

export const GET = studioRoute<Params>(async ({ params, userId }) => {
  const project = await getOwnedProject(userId, params.projectId);
  const deployments = await prisma.studioDeployment.findMany({
    where: { project_id: project.id },
    orderBy: { created_at: "desc" },
    take: 20,
    include: { build: { select: { contracts: true } } },
  });
  return { deployments: deployments.map(viewOf) };
});

export const POST = studioRoute<Params>(async ({ request, params, userId }) => {
  const deployment = await proposeDeployment(userId, params.projectId, await parseBody(request, proposeDeploymentSchema));
  return { deploymentId: deployment.id };
});
