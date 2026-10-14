import { writeFileSchema } from "@/types/studio";
import { deleteFile, listFiles, readFile, writeFile } from "@/server/services/studio/files";
import { StudioError } from "@/server/services/studio/errors";
import { parseBody, studioRoute } from "../../../_lib/route";

export const runtime = "nodejs";

type Params = { projectId: string };

/** ?path=contracts/X.sol returns one file with its content; otherwise the listing. */
export const GET = studioRoute<Params>(async ({ request, params, userId }) => {
  const path = request.nextUrl.searchParams.get("path");
  if (path) {
    const file = await readFile(userId, params.projectId, path);
    return { path: file.path, content: file.content, sha256: file.sha256, updatedAt: file.updated_at };
  }
  return { files: await listFiles(userId, params.projectId) };
});

export const PUT = studioRoute<Params>(async ({ request, params, userId }) => {
  const { path, content } = await parseBody(request, writeFileSchema);
  return writeFile(userId, params.projectId, path, content);
});

export const DELETE = studioRoute<Params>(async ({ request, params, userId }) => {
  const path = request.nextUrl.searchParams.get("path");
  if (!path) throw new StudioError(400, "Pass ?path=");
  await deleteFile(userId, params.projectId, path);
  return { ok: true };
});
