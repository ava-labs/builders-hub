import { exportProject } from "@/server/services/studio/export";
import { studioRoute } from "../../../_lib/route";

export const runtime = "nodejs";

export const GET = studioRoute<{ projectId: string }>(async ({ params, userId }) => {
  const { filename, body } = await exportProject(userId, params.projectId);
  return new Response(new Uint8Array(body), {
    headers: {
      "content-type": "application/gzip",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
});
