import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { del, put } from "@vercel/blob";
import { withAuditor } from "@/app/api/audits/portal/utils";
import { applyRateLimit, DAY_MS } from "@/app/api/audits/utils";
import { isAllowedLogoSrc } from "@/lib/audits/logoSrc";
import {
  doesExtensionMatchMimeType,
  isValidFileSize,
  isValidFileType,
} from "@/server/services/fileValidation";
import { updateAuditor } from "@/server/services/audits/auditors";

const MAX_LOGO_MB = 2;
// The multipart body is parsed in full before the file's own size is known;
// the declared length is refused first, with headroom for the form framing.
const MAX_BODY_BYTES = MAX_LOGO_MB * 1024 * 1024 + 64 * 1024;
const LIMIT = { windowMs: DAY_MS, maxRequests: 20 };
const SAVE_FAILED = "We couldn't save the logo right now.";

/**
 * The sibling portal writes are JSON-only, which no cross-site form can
 * produce. Multipart can, so this route reads the browser's fetch metadata:
 * a cross-site request is refused. Defence in depth over the session cookie's
 * SameSite=Lax default: clients without the header (non-browsers, older
 * browsers) are not refused, the header is absent there, never falsified.
 */
function isCrossSite(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  return site !== null && !["same-origin", "same-site", "none"].includes(site);
}

/** Our own store AND this firm's own folder: the only blobs a firm may unpublish. */
function isOwnFirmBlob(url: string, auditorId: string): boolean {
  if (!isAllowedLogoSrc(url)) return false;
  return new URL(url).pathname.startsWith(`/audits/firms/${auditorId}/`);
}

/** Best effort, after the row is saved: a failed delete never fails the request. */
async function unpublish(url: string, token: string): Promise<void> {
  try {
    await del(url, { token });
  } catch (err) {
    console.error("[Audits] logo blob delete failed:", err);
  }
}

function refuse(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

/**
 * A firm uploads its own logo (any active identity, like the website). Not the
 * generic /api/file route: that one keys blobs by the session user id, which
 * for portal-only (pending_) sessions is the signed-in EMAIL, so the public
 * logo URL would carry it; and it hands the client a URL to send back, which
 * would mean opening the self schema to arbitrary store URLs. Here the file
 * lands under a firm-scoped key, the returned URL must pass isAllowedLogoSrc
 * before it is saved, and the save goes through updateAuditor so the trail
 * records logo_url with the actor email. The previous mark is unpublished
 * once the new one is saved, so "Replace" and "Remove" mean what they say.
 * The response is built from the saved value, never from the row (S-5).
 */
export const POST = withAuditor(async (request, _context, auditor, actorEmail) => {
  if (isCrossSite(request)) return refuse("Cross-site requests are not allowed.", 403);
  const limited = applyRateLimit("firm-logo", auditor.quote_email, LIMIT);
  if (limited) return limited;

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error("[Audits] BLOB_READ_WRITE_TOKEN is not set; portal logo upload refused.");
    return refuse("Logo uploads are not configured.", 500);
  }
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return refuse(`Keep the logo under ${MAX_LOGO_MB}MB.`, 413);

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return refuse("Send the logo as multipart form data.", 400);
  }
  if (!(file instanceof File)) return refuse("Attach a PNG or JPG file.", 400);
  if (!isValidFileType(file) || !doesExtensionMatchMimeType(file)) {
    return refuse("Use a PNG or JPG file.", 400);
  }
  if (!isValidFileSize(file, MAX_LOGO_MB)) {
    return refuse(`Keep the logo under ${MAX_LOGO_MB}MB.`, 400);
  }

  // The extension is present and matches the type (checked above).
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  const key = `audits/firms/${auditor.id}/${randomUUID()}${ext}`;
  const previous = auditor.logo_url;
  let stored: string;
  try {
    stored = (await put(key, file, { access: "public", token })).url;
  } catch (err) {
    console.error("[Audits] portal logo upload failed:", err);
    return refuse(SAVE_FAILED, 500);
  }

  // From here on, every exit that does not save the row unpublishes the
  // object it just stored; nothing else would ever find it again.
  if (!isAllowedLogoSrc(stored)) {
    console.error("[Audits] logo store returned a URL off the allowed host; not saved.");
    await unpublish(stored, token);
    return refuse(SAVE_FAILED, 500);
  }
  try {
    const result = await updateAuditor(
      auditor.id,
      { logo_url: stored },
      { type: "auditor", id: auditor.id, email: actorEmail },
    );
    if (!result.success) {
      await unpublish(stored, token);
      return refuse("Firm not found.", 404);
    }
  } catch (err) {
    console.error("[Audits] portal logo save failed:", err);
    await unpublish(stored, token);
    return refuse(SAVE_FAILED, 500);
  }
  if (previous && isOwnFirmBlob(previous, auditor.id)) await unpublish(previous, token);
  return NextResponse.json({ success: true, logo_url: stored });
});

/** Clears the firm's logo and unpublishes its own blob; the public row falls back to the monogram. */
export const DELETE = withAuditor(async (request, _context, auditor, actorEmail) => {
  if (isCrossSite(request)) return refuse("Cross-site requests are not allowed.", 403);
  const limited = applyRateLimit("firm-logo", auditor.quote_email, LIMIT);
  if (limited) return limited;

  const previous = auditor.logo_url;
  const result = await updateAuditor(
    auditor.id,
    { logo_url: null },
    { type: "auditor", id: auditor.id, email: actorEmail },
  );
  if (!result.success) return refuse("Firm not found.", 404);

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (previous && isOwnFirmBlob(previous, auditor.id)) {
    if (token) await unpublish(previous, token);
    else console.error("[Audits] BLOB_READ_WRITE_TOKEN is not set; previous logo blob kept.");
  }
  return NextResponse.json({ success: true, logo_url: null });
});
