import { prisma } from "@/prisma/prisma";

/**
 * Validates if a user has permissions to delete a file
 * 
 * Validation rules:
 * 1. If the user has "admin" role in custom_attributes, they can delete any file
 * 2. If not admin:
 *    - If the image belongs to a project, verify that the user is a member of the project
 *    - If it's a profile image, verify that the user is the owner of the profile
 * 
 * @param fileName - File name or full URL of the file
 * @param userId - ID of the user attempting to delete the file
 * @param customAttributes - Array of user custom attributes (includes roles)
 * @returns Promise<boolean> - true if has permissions, false otherwise
 */
export async function canUserDeleteFile(
  fileName: string,
  userId: string,
  customAttributes: string[] = []
): Promise<boolean> {
  // Check if user is admin
  if (customAttributes.includes("admin")) {
    return true;
  }

  // Search if the file belongs to a project (pass the original fileName which can be URL or name)
  const project = await findProjectByImageUrl(fileName);

  if (project) {
    // Verify if the user is a member of the project
    const isMember = await isUserProjectMember(userId, project.id);
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
 * Searches for a project that contains the image in logo_url, cover_url or screenshots
 * Searches both by full URL and by file name
 */
async function findProjectByImageUrl(fileIdentifier: string): Promise<{ id: string } | null> {
  // Extract the file name from the URL if necessary
  const fileName = extractFileNameFromUrl(fileIdentifier);

  const project = await prisma.project.findFirst({
    where: {
      OR: [
        // Search by full URL
        { logo_url: { contains: fileIdentifier } },
        { cover_url: { contains: fileIdentifier } },
        { small_cover_url: { contains: fileIdentifier } },
        // Search by file name
        { logo_url: { contains: fileName } },
        { cover_url: { contains: fileName } },
        { small_cover_url: { contains: fileName } },
        // For screenshots (array), search if it contains the full URL or the name
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
 * Verifies if a user is a member of a project
 */
async function isUserProjectMember(userId: string, projectId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user) {
    return false;
  }

  const member = await prisma.member.findFirst({
    where: {
      project_id: projectId,
      OR: [
        { user_id: userId },
        { email: user.email },
      ],
      status: {
        not: "Removed",
      },
    },
  });

  return !!member;
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
