import { prisma } from "@/prisma/prisma";
import { ALLOWED_FILE_TYPES } from "@/constants/upload";
import { isProjectMemberOrInvitee, memberIdentityWhere } from "./projectMembership";
import { MemberStatus } from "@/types/project";

/**
 * Maps MIME types to their expected file extensions
 */
const MIME_TO_EXTENSIONS: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/svg+xml': ['.svg'],
};

/**
 * Validates that a file's MIME type is in the allowlist
 */
export function isValidFileType(file: File): boolean {
  return ALLOWED_FILE_TYPES.includes(file.type);
}

/**
 * Validates that a file's extension matches its declared MIME type.
 * Returns false if the extension contradicts the MIME type (e.g. .exe with image/png).
 * Files with no extension are allowed if the MIME type is valid (e.g. base64-converted uploads).
 */
export function doesExtensionMatchMimeType(file: File): boolean {
  const name = file.name.toLowerCase();
  const dotIndex = name.lastIndexOf('.');

  // Reject files without a proper extension — a missing extension bypasses the
  // extension-vs-MIME check and allows arbitrary content under a known MIME type.
  if (dotIndex === -1 || dotIndex === name.length - 1) {
    return false;
  }

  const ext = name.slice(dotIndex);
  const allowedExtensions = MIME_TO_EXTENSIONS[file.type];

  // If MIME type isn't in our map, it shouldn't have passed isValidFileType
  if (!allowedExtensions) {
    return false;
  }

  return allowedExtensions.includes(ext);
}

/**
 * Uploads are stored under a server-generated key of the form
 * `<uploaderUserId>/<uuid><ext>`, so the key itself records who owns the file.
 * That makes ownership checkable without consulting any table a caller can
 * write to — which is the whole problem with deriving it from project rows:
 * anyone can create a project whose logo_url points at someone else's blob and
 * make the lookup "confirm" their ownership.
 *
 * Returns null for legacy keys written before the prefix existed.
 */
export function uploaderIdFromBlobKey(fileNameOrUrl: string): string | null {
  const key = blobKeyFromIdentifier(fileNameOrUrl);
  if (!isWellFormedBlobKey(key)) return null;
  return key.slice(0, key.indexOf('/'));
}

/**
 * Exactly `<userId>/<name>`: two non-empty segments, nothing else.
 *
 * The shape is the whole security property, so it is checked rather than
 * guessed at. A third segment, a traversal segment, or an empty one all mean
 * the key is not one this service minted, and a key that is not ours must
 * never resolve to an owner — `uploaderIdFromBlobKey` returning a prefix is
 * what grants the delete.
 *
 * Legacy keys are deliberately NOT this shape, so they resolve to no owner
 * and stay admin-only. Use isSafeBlobKey for the separate question of whether
 * a key is safe to address at all.
 */
export function isWellFormedBlobKey(key: string): boolean {
  const parts = key.split('/');
  if (parts.length !== 2) return false;
  return parts.every((part) => isSafeSegment(part));
}

function isSafeSegment(part: string): boolean {
  return part.length > 0 && part !== '.' && part !== '..';
}

/**
 * Addressable at all: no empty, `.` or `..` segment anywhere.
 *
 * This is the traversal guard, separate from ownership. Legacy keys of any
 * depth pass it and remain admin-only, while a key that could resolve to a
 * different object is refused before any permission question is asked.
 *
 * `..` matters because `blobKeyFromIdentifier` percent-decodes AFTER the URL
 * parser has normalised dot segments, so `%2F..%2F` arrives here as real
 * separators the parser never got to collapse.
 */
export function isSafeBlobKey(key: string): boolean {
  if (key.length === 0) return false;
  return key.split('/').every((part) => isSafeSegment(part));
}

/**
 * The storage key for a blob, preserving any directory prefix.
 *
 * Taking only the last path segment (as this used to) turns
 * `user-123/abc.png` into `abc.png`, which is a different object — the delete
 * then silently addresses nothing.
 */
export function blobKeyFromIdentifier(fileNameOrUrl: string): string {
  try {
    const url = new URL(fileNameOrUrl);
    return decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  } catch {
    return fileNameOrUrl.replace(/^\/+/, '');
  }
}

/**
 * Legacy blobs — those written before the key carried an uploader prefix —
 * have no trustworthy owner record anywhere. The only evidence of ownership is
 * the project/profile tables, and any caller can write a row into those that
 * points at someone else's blob, which is precisely the attack this file now
 * closes. So legacy keys are admin-only: there is no way to tell a legitimate
 * owner from a spoofer, and guessing wrong deletes a stranger's file.
 *
 * The practical cost is that replacing an image uploaded before the prefix
 * existed leaves the old blob orphaned in storage instead of deleting it. That
 * is a storage cost, not a broken flow — the replacement still uploads and the
 * new URL is still saved.
 *
 * Set this to true only as a temporary escape hatch, knowing it restores a
 * spoofable path. Typed as `boolean` rather than inferred as `false` so the
 * fallback below stays reachable code.
 */
export const ALLOW_LEGACY_UNPREFIXED_DELETES: boolean = false;

/**
 * First bytes every real file of that type starts with. The declared MIME
 * type and the extension both come from the client, so on their own they say
 * nothing about the content; this reads the file itself.
 */
const IMAGE_SIGNATURES: Record<string, number[][]> = {
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  'image/jpeg': [[0xff, 0xd8, 0xff]],
};

/**
 * True when the file's own bytes match its declared image type. Unknown types
 * return false: a caller reaches this only after an allowlist, so an entry
 * missing here is a signature that still needs writing, not a pass.
 */
export async function hasMatchingImageSignature(file: File): Promise<boolean> {
  const signatures = IMAGE_SIGNATURES[file.type];
  if (!signatures) return false;
  const longest = Math.max(...signatures.map((signature) => signature.length));
  const head = new Uint8Array(await file.slice(0, longest).arrayBuffer());
  return signatures.some(
    (signature) =>
      head.length >= signature.length && signature.every((byte, i) => head[i] === byte),
  );
}

/**
 * Validates if a user has permissions to delete a file
 * 
 * Validation rules:
 * 1. If the user has "admin" role in custom_attributes, they can delete any file
 * 2. If hackathonId is provided, verify user is a member of a project in that hackathon
 * 3. If not admin and no hackathonId:
 *    - If the image belongs to a project, verify that the user is a member of the project
 *    - If it's a profile image, verify that the user is the owner of the profile
 * 
 * @param fileName - File name or full URL of the file
 * @param userId - ID of the user attempting to delete the file
 * @param customAttributes - Array of user custom attributes (includes roles)
 * @param hackathonId - Optional hackathon ID for direct project validation
 * @returns Promise<boolean> - true if has permissions, false otherwise
 */
export async function canUserDeleteFile(
  fileName: string,
  userId: string,
  customAttributes: string[] = [],
  hackathonId?: string
): Promise<boolean> {
  // Authoritative check first: if the key carries an uploader id, that is the
  // owner, full stop. No table consulted, so nothing a caller can write to can
  // influence the answer.
  const uploaderId = uploaderIdFromBlobKey(fileName);
  if (uploaderId !== null) {
    if (uploaderId === userId) return true;
    return customAttributes.includes("admin");
  }

  // Legacy key with no uploader prefix — falls through to the weaker
  // project/profile matching below.
  if (!ALLOW_LEGACY_UNPREFIXED_DELETES) {
    return customAttributes.includes("admin");
  }

  // Check if user is admin
  if (customAttributes.includes("admin")) {
    return true;
  }

  // If hackathonId is provided, validate directly through project membership
  if (hackathonId) {
    const project = await findProjectByHackathonAndUser(hackathonId, userId);
    if (project) {
      console.log("Project found by hackathonId and userId:", project.id);
      return true;
    }
  }

  // Fallback: Search if the file belongs to a project (pass the original fileName which can be URL or name)
  const project = await findProjectByImageUrl(fileName);
  console.log("project found by image URL:", project);
  if (project) {
    // Verify if the user is a member of the project
    const isMember = await isProjectMemberOrInvitee(userId, project.id);
    return isMember;
  }

  // Search if it's a profile image (pass the original fileName which can be URL or name)
  const profileOwner = await findProfileByImageUrl(fileName);

  if (profileOwner) {
    // Verify if the user is the owner of the profile
    return profileOwner.id === userId;
  }

  // If not found in projects or profiles, deny by default
  return false;
}

/**
 * Extracts the file name from a full URL
 */
function extractFileNameFromUrl(fileNameOrUrl: string): string {
  try {
    // If it's a full URL, extract the file name
    if (fileNameOrUrl.includes("/")) {
      const url = new URL(fileNameOrUrl);
      return url.pathname.split("/").pop() || fileNameOrUrl;
    }
    // If it's already just the file name, return it as is
    return fileNameOrUrl;
  } catch {
    // If it's not a valid URL, assume it's the file name
    return fileNameOrUrl;
  }
}

/**
 * Finds a project by hackathon ID and user membership
 * This is used for direct validation when we know the hackathon context
 */
async function findProjectByHackathonAndUser(
  hackathonId: string,
  userId: string
): Promise<{ id: string } | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user) {
    return null;
  }

  const project = await prisma.project.findFirst({
    where: {
      hackaton_id: hackathonId,
      members: {
        some: {
          ...memberIdentityWhere({ id: userId, email: user.email }),
          status: { not: MemberStatus.REMOVED },
        },
      },
    },
    select: {
      id: true,
    },
  });

  return project;
}

/**
 * Searches for a project that contains the image in logo_url, cover_url or screenshots
 * Searches both by full URL and by file name
 */
async function findProjectByImageUrl(fileIdentifier: string): Promise<{ id: string } | null> {
  // Extract the file name from the URL if necessary
  const fileName = extractFileNameFromUrl(fileIdentifier);

  // Use exact equality rather than substring `contains` matching.
  // Substring matching allowed an attacker to create a project whose logo_url
  // contained the victim's blob URL, causing the ownership check to pass for
  // an arbitrary file.  Exact matching is strictly safer.
  const project = await prisma.project.findFirst({
    where: {
      OR: [
        { logo_url: fileIdentifier },
        { cover_url: fileIdentifier },
        { small_cover_url: fileIdentifier },
        { logo_url: fileName },
        { cover_url: fileName },
        { small_cover_url: fileName },
        {
          screenshots: {
            hasSome: [fileIdentifier, fileName],
          },
        },
      ],
    },
    select: {
      id: true,
    },
  });

  return project;
}


/**
 * Searches for a user profile that has the specified image
 * Searches both by full URL and by file name
 */
async function findProfileByImageUrl(fileIdentifier: string): Promise<{ id: string } | null> {
  // Extract the file name from the URL if necessary
  const fileName = extractFileNameFromUrl(fileIdentifier);

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { image: { contains: fileIdentifier } },
        { image: { contains: fileName } },
      ],
    },
    select: {
      id: true,
    },
  });

  return user;
}

/**
 * Validates if a user has permissions to upload a file
 * Reuses the same validation logic as delete: admin check
 * 
 * Validation rules:
 * 1. If the user has "admin" role in custom_attributes, they can upload any file
 * 2. Otherwise, allow upload (authentication is already handled by withAuth middleware)
 * 
 * Note: Most uploads don't include hackathon_id, so we only validate admin status.
 * If hackathon-specific validation is needed in the future, it can be added here.
 * 
 * @param userId - ID of the user attempting to upload the file
 * @param customAttributes - Array of user custom attributes (includes roles)
 * @returns Promise<boolean> - true if has permissions, false otherwise
 */
export async function canUserUploadFile(
  userId: string,
  customAttributes: string[] = []
): Promise<boolean> {
  // Check if user is admin (same logic as delete)
  if (customAttributes.includes("admin")) {
    return true;
  }

  // All authenticated users can upload files (authentication is handled by withAuth)
  return true;
}

/**
 * Validates file size (max 10MB by default)
 */
export function isValidFileSize(file: File, maxSizeMB: number = 10): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
}
