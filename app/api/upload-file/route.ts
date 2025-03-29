import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const blob = await put(file.name, file, {
    access: 'public', 
    token: process.env.BLOB_READ_WRITE_TOKEN, 
  });

  return NextResponse.json({ url: blob.url });
}