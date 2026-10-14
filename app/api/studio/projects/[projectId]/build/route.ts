import { buildProject } from "@/server/services/studio/builds";
import { studioRoute } from "../../../_lib/route";

export const runtime = "nodejs";
// A cold instance downloads the compiler and the pinned dependency tarballs first.
export const maxDuration = 300;

export const POST = studioRoute<{ projectId: string }>(async ({ params, userId }) => {
  const { build, audit } = await buildProject(userId, params.projectId);
  return { build, audit };
});
