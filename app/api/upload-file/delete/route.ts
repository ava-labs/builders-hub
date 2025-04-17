import { del } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';


export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fileName = searchParams.get("fileName");
  const url = searchParams.get("url");
  
  if (!fileName && !url) {
    return NextResponse.json({ error: "fileName or URL is required" }, { status: 400 });
  }
  
  try {
    await del(fileName || url!, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    
    return NextResponse.json({ message: "File deleted successfully" });
  } catch (error) {
    return NextResponse.json({ error: "Error deleting file" }, { status: 500 });
  }
}
