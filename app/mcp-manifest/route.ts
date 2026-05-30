import { NextResponse } from 'next/server';
import manifestData from '@/public/mcp-manifest.json';

export async function GET() {
  return NextResponse.json(manifestData, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
