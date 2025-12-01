
import { withAuth } from '@/lib/protectedRoute';
import { del, put } from '@vercel/blob';
import { NextResponse, NextRequest } from 'next/server';
import { 
  canUserDeleteFile,
  canUserUploadFile,
  isValidFileSize
} from '@/server/services/fileValidation';


export const POST = withAuth(async (request: Request, context: any, session: any) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'invalid file' }, { status: 400 });
    }

    const typedFile = file as File;

    // Validate file size (max 10MB)
    if (!isValidFileSize(typedFile, 10)) {
      return NextResponse.json(
        { error: 'File size exceeds the maximum limit of 10MB' },
        { status: 400 }
      );
    }

    // Validate permissions
    const customAttributes = (session?.user?.custom_attributes as string[]) || [];
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 401 }
      );
    }

    const hasPermission = await canUserUploadFile(
      userId,
      customAttributes
    );

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'You do not have permission to upload files' },
        { status: 403 }
      );
    }

    // Upload the file
    const blob = await put(typedFile.name, typedFile, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN!,
    });

    return NextResponse.json({ url: blob.url });
  } catch (error: any) {
    console.error('Error uploading file:', error);
    console.error('Error POST /api/file:', error.message);
    const wrappedError = error as Error;
    return NextResponse.json(
      { error: wrappedError },
      { status: wrappedError.cause == 'ValidationError' ? 400 : 500 }
    );
  }
});

export const DELETE = withAuth(async (request: NextRequest, context: any, session: any) => {
  const { searchParams } = new URL(request.url);
  const fileName = searchParams.get('fileName');
  const url = searchParams.get('url');

  if (!fileName && !url) {
    return NextResponse.json(
      { error: 'fileName or URL is required' },
      { status: 400 }
    );
  }

  // Use fileName if available, otherwise use url
  const fileIdentifier = fileName || url!;

  try {
    // Validate permissions before deleting
    const customAttributes = (session?.user?.custom_attributes as string[]) || [];
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 401 }
      );
    }

    const hasPermission = await canUserDeleteFile(
      fileIdentifier,
      userId,
      customAttributes
    );

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this file' },
        { status: 403 }
      );
    }

    // Extract the file name to verify existence and deletion
    let actualFileName = fileIdentifier;
    if (fileIdentifier.includes('/')) {
      try {
        const urlObj = new URL(fileIdentifier);
        actualFileName = urlObj.pathname.split('/').pop() || fileIdentifier;
      } catch {
        // If it's not a valid URL, use the identifier as is
        actualFileName = fileIdentifier.split('/').pop() || fileIdentifier;
      }
    }

    // Check if the file exists
    const blobExists = await fetch(`${process.env.BLOB_BASE_URL}/${actualFileName}`, {
      method: 'HEAD',
    }).then(res => res.ok).catch(() => false);

    if (!blobExists) {
      return NextResponse.json(
        { message: 'The file does not exist or has already been deleted' },
        { status: 201 }
      );
    }

    // Delete the file
    await del(actualFileName, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json({ error: 'Error deleting file' }, { status: 500 });
  }
});
