import { randomUUID } from "crypto";
import sharp from "sharp";

/* A profile photo is never stored as sent. The bytes must start like a PNG
   or a JPEG; sharp then decodes them and writes a new 512 px JPEG. The
   re-encode drops everything that is not pixels: EXIF (GPS included),
   comments, trailing data and any script in a polyglot file. The result
   lands in the user's own folder of the blob store, the only place the
   profile reads a photo from. */

// Vercel refuses a function body over 4.5 MB
export const PHOTO_MAX_MB = 4;
export const PHOTO_MAX_BYTES = PHOTO_MAX_MB * 1024 * 1024;
/** what the client may send; the stored photo is always a JPEG */
export const PHOTO_TYPES = ["image/png", "image/jpeg"] as const;
export const PHOTO_SIZE_PX = 512;
// 40 MP: any real photo, and no decompression bomb
const MAX_INPUT_PIXELS = 40_000_000;
// A cover resize scales the short side to 512 px: a 4000x1 strip would grow to
// 2,048,000x512 in memory (gigabytes). A photo is no longer than 4:1.
const MAX_ASPECT = 4;
const FOLDER = "profile-photos";
const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

const SIGNATURES: Record<(typeof PHOTO_TYPES)[number], number[]> = {
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  "image/jpeg": [0xff, 0xd8, 0xff],
};

/** the type the bytes prove, or null; the declared type and the name are not trusted */
export function sniffPhotoType(bytes: Uint8Array): (typeof PHOTO_TYPES)[number] | null {
  for (const type of PHOTO_TYPES) {
    const signature = SIGNATURES[type];
    if (bytes.length >= signature.length && signature.every((byte, i) => bytes[i] === byte)) return type;
  }
  return null;
}

/** a strip, not a photo: its cover resize would take gigabytes */
export class PhotoShapeError extends Error {}

/** decodes the photo and writes a clean square JPEG; throws on a file sharp cannot read or a strip shape */
export async function reencodePhoto(bytes: Uint8Array): Promise<Buffer> {
  // the header only: cheap, and before any pixel is decoded
  const { width = 0, height = 0 } = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  if (!width || !height || Math.max(width, height) > MAX_ASPECT * Math.min(width, height)) {
    throw new PhotoShapeError("the image is longer than 4:1");
  }
  return sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error", animated: false })
    .rotate() // apply the EXIF orientation before the metadata goes
    .resize(PHOTO_SIZE_PX, PHOTO_SIZE_PX, { fit: "cover", position: "attention" })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}

/** a new key in the user's folder; the user id is a database id, never an email */
export function photoKey(userId: string): string {
  return `${FOLDER}/${userId}/${randomUUID()}.jpg`;
}

/** true for a photo this program stored for this user, so it may delete it */
export function isOwnPhoto(url: string | null | undefined, userId: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.endsWith(BLOB_HOST_SUFFIX) &&
      parsed.pathname.startsWith(`/${FOLDER}/${userId}/`)
    );
  } catch {
    return false;
  }
}

/** the folder prefix of a user's photos, for a list-and-sweep */
export function photoFolder(userId: string): string {
  return `${FOLDER}/${userId}/`;
}
