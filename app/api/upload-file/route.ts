import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try{
    const formData = await request.formData();
    const file = formData.get('file');
  
  
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'invalid file' }, { status: 400 });
    }
  
  
    const typedFile = file as File;
  
    const blob = await put(typedFile.name, typedFile, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN!,
    });
  
    return NextResponse.json({ url: blob.url });
  }
  catch (error: any) {
    console.error('Error uploading file:', error);
    console.error('Error POST /api/upload-file:', error.message);
    const wrappedError = error as Error;
    return NextResponse.json(
      { error: wrappedError },
      { status: wrappedError.cause == 'ValidationError' ? 400 : 500 }
    );
  }

}