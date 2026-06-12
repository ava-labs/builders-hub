import { NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/authSession';
import { buildApkg } from '@/lib/flashcards/apkg';
import { DeckSchema } from '@/lib/flashcards/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

function safeFilename(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 80) || 'flashcards'
  );
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Sign in to download generated decks' },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parseResult = DeckSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Invalid deck payload', issues: parseResult.error.issues },
      { status: 400 },
    );
  }

  let apkg: Buffer;
  try {
    apkg = await buildApkg(parseResult.data);
  } catch (error) {
    console.error('[flashcards/studio-download] Failed to build .apkg:', error);
    return NextResponse.json(
      { error: 'Failed to build Anki deck' },
      { status: 500 },
    );
  }

  const apkgBytes = new Uint8Array(apkg);
  const filename = `${safeFilename(parseResult.data.title)}.apkg`;
  return new Response(apkgBytes, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(apkgBytes.byteLength),
      'Cache-Control': 'no-store',
    },
  });
}
