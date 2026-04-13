import type { NextRequest } from 'next/server';
import { del, put } from '@vercel/blob';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { AuthError, BadRequestError, ForbiddenError, NotFoundError } from '@/lib/api/errors';
import {
  canUserDeleteFile,
  canUserUploadFile,
  isValidFileSize,
  isValidFileType,
  doesExtensionMatchMimeType,
} from '@/server/services/fileValidation';

// ---------------------------------------------------------------------------
// POST /api/file  — Upload a file (auth required)
// ---------------------------------------------------------------------------

// schema: not applicable — FormData binary upload, not JSON body
export const POST = withApi(
  async (req: NextRequest, { session }) => {
    const userId = session.user?.id;
    if (!userId) {
      throw new AuthError('User ID is required');
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      throw new BadRequestError('Invalid file');
    }

    const typedFile = file as File;

    // Validate MIME type against allowlist
    if (!isValidFileType(typedFile)) {
      throw new BadRequestError('File type not supported. Please upload a PNG, JPG, or SVG.');
    }

    // Validate file extension matches declared MIME type
    if (!doesExtensionMatchMimeType(typedFile)) {
      throw new BadRequestError('File extension does not match its content type.');
    }

    // Validate file size (max 10MB)
    if (!isValidFileSize(typedFile, 10)) {
      throw new BadRequestError('File size exceeds the maximum limit of 10MB');
    }

    // Validate upload permissions
    const customAttributes = (session.user?.custom_attributes as string[]) || [];
    const hasPermission = await canUserUploadFile(userId, customAttributes);
    if (!hasPermission) {
      throw new ForbiddenError('You do not have permission to upload files');
    }

    const blob = await put(typedFile.name, typedFile, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN!,
    });

    return successResponse({ url: blob.url }, 201);
  },
  { auth: true },
);

// ---------------------------------------------------------------------------
// DELETE /api/file  — Delete a file (auth required)
// ---------------------------------------------------------------------------

export const DELETE = withApi(
  async (req: NextRequest, { session }) => {
    const userId = session.user?.id;
    if (!userId) {
      throw new AuthError('User ID is required');
    }

    const fileName = req.nextUrl.searchParams.get('fileName');
    const url = req.nextUrl.searchParams.get('url');
    // Support both spellings for backward compatibility
    const hackathonId = req.nextUrl.searchParams.get('hackaton_id') || req.nextUrl.searchParams.get('hackathon_id');

    if (!fileName && !url) {
      throw new BadRequestError('fileName or URL is required');
    }

    const fileIdentifier = fileName || url!;

    // Validate delete permissions
    const customAttributes = (session.user?.custom_attributes as string[]) || [];
    const hasPermission = await canUserDeleteFile(fileIdentifier, userId, customAttributes, hackathonId || undefined);

    if (!hasPermission) {
      throw new ForbiddenError('You do not have permission to delete this file');
    }

    // Extract actual file name from URL if needed
    let actualFileName = fileIdentifier;
    if (fileIdentifier.includes('/')) {
      try {
        const urlObj = new URL(fileIdentifier);
        actualFileName = urlObj.pathname.split('/').pop() || fileIdentifier;
      } catch {
        actualFileName = fileIdentifier.split('/').pop() || fileIdentifier;
      }
    }

    // Check existence
    const blobExists = await fetch(`${process.env.BLOB_BASE_URL}/${actualFileName}`, {
      method: 'HEAD',
    })
      .then((res) => res.ok)
      .catch(() => false);

    if (!blobExists) {
      throw new NotFoundError('File does not exist or has already been deleted');
    }

    await del(actualFileName, { token: process.env.BLOB_READ_WRITE_TOKEN });

    return successResponse({ message: 'File deleted successfully' });
  },
  { auth: true },
);
