import { del } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';


export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fileName = searchParams.get("fileName");
  
  if (!fileName) {
    return NextResponse.json({ error: "fileName is required" }, { status: 400 });
  }
  
  try {
   
    await del(fileName, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    
    return NextResponse.json({ message: "File deleted successfully" });
  } catch (error) {
    return NextResponse.json({ error: "Error deleting file" }, { status: 500 });
  }
}
