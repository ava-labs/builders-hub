import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { prisma } from "@/prisma/prisma";
import { MAX_ATTACHMENT_BYTES } from "@/types/audits";
import { applyRateLimit, HOUR_MS, requireProjectUser } from "@/app/api/audits/utils";

// Docs/spec attachments: pdf / text / raster image, up to 128MB each (Areta
// parity). Enumerated rather than "image/*": that wildcard admits
// image/svg+xml, which is a scriptable document, and these files are read
// back by audit firms and the program team.
const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
];

/**
 * Client-upload token exchange: 128MB cannot sanely route through a function
 * body, so the browser uploads straight to Blob with a token minted here.
 *
 * The token is minted FOR ONE DRAFT the caller owns: clientPayload carries the
 * request id and it is checked against user_id + status "draft" before any
 * token exists. Without that, a signed-in caller could mint unlimited store
 * keys with no request behind them.
 *
 * Reads do not go through the store: the URL is saved on the draft and served
 * by /api/audits/attachments/<request>/<index>, which re-authorizes per read.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const { caller, error } = await requireProjectUser();
  if (error) return error;
  const limited = applyRateLimit("attachment", caller.email, {
    windowMs: HOUR_MS,
    maxRequests: 40,
  });
  if (limited) return limited;

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ success: false, message: "Invalid body" }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!/^audits\/[^/]{1,300}$/.test(pathname)) {
          throw new Error("Attachments must upload under the audits/ prefix.");
        }
        let requestId: unknown;
        try {
          requestId = JSON.parse(clientPayload ?? "{}")?.requestId;
        } catch {
          throw new Error("Attachments need the draft they belong to.");
        }
        if (typeof requestId !== "string" || requestId.length === 0) {
          throw new Error("Attachments need the draft they belong to.");
        }
        // Owner + draft pinned, the same gate patchDraft applies to the write
        // that will store this URL.
        const draft = await prisma.auditRequest.findFirst({
          where: { id: requestId, user_id: caller.userId, status: "draft" },
          select: { id: true },
        });
        if (!draft) throw new Error("Draft not found or no longer editable.");

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_ATTACHMENT_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: caller.userId, requestId: draft.id }),
        };
      },
      // Does not fire on localhost; the client PATCHes the attachment list
      // onto the draft after upload() resolves, so this is not load-bearing.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse);
  } catch (err) {
    console.error("[Audits] attachment token failed:", err);
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Upload failed." },
      { status: 400 },
    );
  }
}
