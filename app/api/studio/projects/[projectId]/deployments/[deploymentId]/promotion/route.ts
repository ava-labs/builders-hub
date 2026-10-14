import { NextResponse } from "next/server";
import { z } from "zod";
import { createPromotion, promotionPreview } from "@/server/services/studio/promotions";
import { parseBody, studioRoute } from "../../../../../_lib/route";

export const runtime = "nodejs";

type Params = { projectId: string; deploymentId: string };

const schema = z.object({ testsConfirmed: z.literal(true, { message: "Confirm the Foundry tests pass first" }) });

export const GET = studioRoute<Params>(async ({ params, userId }) => promotionPreview(userId, params.projectId, params.deploymentId));

export const POST = studioRoute<Params>(async ({ request, params, userId }) => {
  await parseBody(request, schema);
  const result = await createPromotion(userId, params.projectId, params.deploymentId);
  if (!result.ok) return NextResponse.json({ error: "gates", message: "Promotion is blocked", gates: result.gates }, { status: 409 });
  return { promotionId: result.promotion.id, deploymentId: result.deployment.id, gates: result.gates };
});
