import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { MAX_ATTACHMENT_BYTES } from "@/types/audits";
import { applyRateLimit, HOUR_MS, requireProjectUser } from "@/app/api/audits/utils";

// Docs/spec attachments: pdf / text / image, up to 128MB each (Areta parity).
// Client-upload token exchange because 128MB cannot sanely route through a
// function body; the browser uploads straight to Blob with the token minted
// here. Ownership is tracked on the draft row (the client PATCHes the
// attachment list onto its own draft), and blob URLs are public-but-
// unguessable with a random suffix, consistent with /api/file.
const ALLOWED_CONTENT_TYPES = ["application/pdf", "text/plain", "text/markdown", "image/*"];

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
      onBeforeGenerateToken: async (pathname) => {
        if (!/^audits\/[^/]{1,300}$/.test(pathname)) {
          throw new Error("Attachments must upload under the audits/ prefix.");
        }
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_ATTACHMENT_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: caller.userId }),
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
