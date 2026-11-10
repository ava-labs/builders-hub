import { bindL1Schema, l1RelayerSchema } from "@/types/studio";
import { bindL1, markRelayerRunning, unbindL1 } from "@/server/services/studio/chain";
import { StudioError } from "@/server/services/studio/errors";
import { parseBody, studioRoute } from "../../../_lib/route";

export const runtime = "nodejs";

type Params = { projectId: string };

export const POST = studioRoute<Params>(async ({ request, params, userId }) => ({
  binding: await bindL1(userId, params.projectId, await parseBody(request, bindL1Schema)),
}));

/** Clears the "relayer not running" mark once the builder has set a relayer up. */
export const PATCH = studioRoute<Params>(async ({ request, params, userId }) => {
  const { stage } = await parseBody(request, l1RelayerSchema);
  await markRelayerRunning(userId, params.projectId, stage);
  return { ok: true };
});

/** ?stage=testnet|production removes that stage's L1 binding. */
export const DELETE = studioRoute<Params>(async ({ request, params, userId }) => {
  const stage = request.nextUrl.searchParams.get("stage");
  if (stage !== "testnet" && stage !== "production") throw new StudioError(400, "Pass ?stage=testnet or ?stage=production");
  await unbindL1(userId, params.projectId, stage);
  return { ok: true };
});
