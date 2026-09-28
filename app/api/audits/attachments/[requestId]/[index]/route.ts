import { NextResponse } from "next/server";
import type { RouteParams } from "@/lib/protectedRoute";
import { getAuthSession } from "@/lib/auth/authSession";
import { canAdministerAuditProgram } from "@/lib/auth/permissions";
import { isAllowedAttachmentSrc } from "@/lib/audits/blobSrc";
import { contentDispositionFor } from "@/lib/audits/attachments";
import { readableAttachment } from "@/server/services/audits/visibility";

// Ten per request (the draft schema's cap), so a nonsense index is refused
// before anything is read.
const MAX_INDEX = 9;

/** Every refusal looks the same: a stranger learns nothing about the request. */
const notFound = () =>
  NextResponse.json({ success: false, message: "Attachment not found." }, { status: 404 });

/**
 * The ONLY way to read a request's uploaded files.
 *
 * The store URL stays server-side: a blob URL is a bearer token, so handing
 * one to a firm means that firm (and anyone it forwards the link to) keeps
 * read access after the quote window closes, after the request is withdrawn
 * and after the firm leaves the whitelist. Here the bytes are proxied and
 * visibility.readableAttachment re-authorizes on EVERY read.
 *
 * The response is deliberately inert: octet-stream with an attachment
 * disposition and nosniff, so nothing a requester uploaded can ever render
 * in our own origin.
 */
export async function GET(
  _request: Request,
  context: RouteParams<{ requestId: string; index: string }>,
) {
  const { requestId, index } = await context.params;
  // Digits only, and only a position that could exist: Number("") is 0 and
  // Number("1e1") is 10, so neither a coercion nor a range check alone is
  // enough to keep this to "the nth element of the stored list".
  if (!/^\d$/.test(index)) return notFound();
  const position = Number(index);
  if (position > MAX_INDEX) return notFound();

  const session = await getAuthSession();
  const userId = session?.user?.id;
  const email = session?.user?.email?.trim().toLowerCase();
  if (!userId || !email) {
    return NextResponse.json(
      { success: false, message: "Please sign in." },
      { status: 401 },
    );
  }

  const attachment = await readableAttachment(requestId, position, {
    userId,
    email,
    isAdmin: canAdministerAuditProgram(session),
  });
  if (!attachment) return notFound();

  // Rows written before the store check existed could hold anything; this is
  // a server-side fetch, so an unchecked URL here would be an SSRF.
  if (!isAllowedAttachmentSrc(attachment.url)) {
    console.error("[Audits] attachment URL is not on our store; refusing to proxy.");
    return notFound();
  }

  let upstream: Response;
  try {
    upstream = await fetch(attachment.url, { cache: "no-store" });
  } catch (err) {
    console.error("[Audits] attachment fetch failed:", err);
    return NextResponse.json(
      { success: false, message: "We couldn't load this attachment right now." },
      { status: 502 },
    );
  }
  if (!upstream.ok || !upstream.body) return notFound();

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": contentDispositionFor(attachment.name),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      ...(upstream.headers.get("content-length")
        ? { "Content-Length": upstream.headers.get("content-length") as string }
        : {}),
    },
  });
}
