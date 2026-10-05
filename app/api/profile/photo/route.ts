import { NextResponse, type NextRequest } from "next/server";
import type { Session } from "next-auth";
import { del, list, put } from "@vercel/blob";

import { withAuth } from "@/lib/protectedRoute";
import { checkRateLimit } from "@/lib/rateLimit";
import { prisma } from "@/prisma/prisma";
import {
  PHOTO_MAX_BYTES,
  PHOTO_MAX_MB,
  PHOTO_TYPES,
  PhotoShapeError,
  isOwnPhoto,
  photoFolder,
  photoKey,
  reencodePhoto,
  sniffPhotoType,
} from "@/server/services/profile-photo";

/* POST /api/profile/photo: set the session user's photo. DELETE: remove it.
   The route owns User.image: the profile PUT does not write it, so no client
   can point a profile at a URL of its choice. Each user keeps one stored
   photo: a save sweeps the user's folder of the other files. */

// The multipart body is read in full before the file's size is known: the
// declared length is refused first, with headroom for the form framing.
const MAX_BODY_BYTES = PHOTO_MAX_BYTES + 64 * 1024;
const LIMIT = { windowMs: 60 * 60 * 1000, maxRequests: 10 };
// a file this young can belong to a save still in flight: the next sweep takes it
const FRESH_MS = 10 * 60 * 1000;
const SAVE_FAILED = "Could not save your photo. Try again.";

function refuse(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "private, no-store" } });
}

/** A multipart POST can come from any site's form: refuse any other origin, a sibling subdomain included
    (the browser sets the header; a client without it has no cookie to ride on). */
function isCrossSite(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  return site !== null && !["same-origin", "none"].includes(site);
}

/** the user id of a finished account; a pending_ session has no row and an email in its id */
function accountId(session: Session): string | null {
  const id = session.user?.id;
  return id && !id.startsWith("pending_") ? id : null;
}

/** per server instance, as the other upload routes: a burst stops here. Remove has its own bucket. */
function limited(bucket: "upload" | "remove", userId: string) {
  const result = checkRateLimit(`profile-photo-${bucket}:${userId}`, LIMIT);
  if (result.allowed) return null;
  const minutes = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 60_000));
  return refuse(`Too many photo changes. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`, 429);
}

/** the user's photo now; a removed photo is null */
async function currentImage(userId: string): Promise<string | null> {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { image: true } });
  return row?.image ?? null;
}

/* Best effort after the row is saved. Two saves at once must not delete the
   photo the row ends on, so the sweep reads the row after the list and keeps
   its photo. It deletes the photo this save replaced, and any other file old
   enough that no save can still be writing it. */
async function sweep(userId: string, replaced: string | null, token: string): Promise<void> {
  try {
    const { blobs } = await list({ prefix: photoFolder(userId), token, limit: 100 });
    const keep = await currentImage(userId);
    const now = Date.now();
    const stale = blobs
      .filter((b) => b.url !== keep && isOwnPhoto(b.url, userId))
      .filter((b) => b.url === replaced || now - new Date(b.uploadedAt).getTime() > FRESH_MS)
      .map((b) => b.url);
    if (stale.length) await del(stale, { token });
  } catch (err) {
    console.error("[profile/photo] sweep failed:", err);
  }
}

export const POST = withAuth(async (request: NextRequest, _context: unknown, session: Session) => {
  if (isCrossSite(request)) return refuse("Cross-site requests are not allowed.", 403);
  const userId = accountId(session);
  if (!userId) return refuse("Finish your signup first.", 403);
  const stop = limited("upload", userId);
  if (stop) return stop;

  // a missing length passes here: Vercel caps a body at 4.5 MB, and the file size is checked below
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return refuse(`Use a photo of ${PHOTO_MAX_MB} MB or less.`, 413);

  let file: FormDataEntryValue | null;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return refuse("Send the photo as multipart form data.", 400);
  }
  if (!(file instanceof File)) return refuse("Attach a PNG or JPG file.", 400);
  if (file.size > PHOTO_MAX_BYTES) return refuse(`Use a photo of ${PHOTO_MAX_MB} MB or less.`, 413);
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) return refuse("Use a PNG or JPG file.", 400);

  // The declared type and the name come from the client; the bytes do not.
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!sniffPhotoType(bytes)) return refuse("That file is not a PNG or JPG image.", 400);
  let clean: Buffer;
  try {
    clean = await reencodePhoto(bytes);
  } catch (err) {
    if (err instanceof PhotoShapeError) return refuse("Use a photo that is at most 4 times as wide as it is tall.", 400);
    return refuse("That image cannot be read. Use another PNG or JPG file.", 400);
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.error("[profile/photo] BLOB_READ_WRITE_TOKEN is not set; upload refused.");
    return refuse("Photo uploads are not configured.", 500);
  }
  let stored: string;
  try {
    stored = (
      await put(photoKey(userId), clean, {
        access: "public",
        token,
        contentType: "image/jpeg",
        addRandomSuffix: false,
      })
    ).url;
  } catch (err) {
    console.error("[profile/photo] upload failed:", err);
    return refuse(SAVE_FAILED, 500);
  }
  if (!isOwnPhoto(stored, userId)) {
    console.error("[profile/photo] the store returned a URL outside the user's folder; not saved.");
    await del(stored, { token }).catch(() => undefined);
    return refuse(SAVE_FAILED, 500);
  }

  let replaced: string | null;
  try {
    replaced = await currentImage(userId);
    await prisma.user.update({ where: { id: userId }, data: { image: stored } });
  } catch (err) {
    console.error("[profile/photo] save failed:", err);
    await del(stored, { token }).catch(() => undefined);
    return refuse(SAVE_FAILED, 500);
  }
  await sweep(userId, replaced, token);
  return NextResponse.json({ image: stored }, { headers: { "Cache-Control": "private, no-store" } });
});

export const DELETE = withAuth(async (request: NextRequest, _context: unknown, session: Session) => {
  if (isCrossSite(request)) return refuse("Cross-site requests are not allowed.", 403);
  const userId = accountId(session);
  if (!userId) return refuse("Finish your signup first.", 403);
  const stop = limited("remove", userId);
  if (stop) return stop;

  // null, not "": sign-in fills an empty photo from Google or GitHub, but
  // leaves a removed one removed (server/services/auth.ts)
  let replaced: string | null;
  try {
    replaced = await currentImage(userId);
    await prisma.user.update({ where: { id: userId }, data: { image: null } });
  } catch (err) {
    console.error("[profile/photo] remove failed:", err);
    return refuse("Could not remove your photo. Try again.", 500);
  }
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token) await sweep(userId, replaced, token);
  return NextResponse.json({ image: "" }, { headers: { "Cache-Control": "private, no-store" } });
});
