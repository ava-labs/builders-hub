import { NextResponse } from 'next/server';
import flashcardData from '@/components/flashcards/flashcardData.json';
import { buildApkg } from '@/lib/flashcards/apkg';
import { legacySetToDeck, parseLegacyData } from '@/lib/flashcards/legacy';

export const runtime = 'nodejs';

function safeFilename(setId: string): string {
  return setId.replace(/[^a-z0-9-_]/gi, '-').slice(0, 80) || 'flashcards';
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ setId: string }> },
) {
  const { setId } = await params;

  if (!setId || setId.length > 120) {
    return NextResponse.json({ error: 'Invalid setId' }, { status: 400 });
  }

  const data = parseLegacyData(flashcardData);
  const deck = legacySetToDeck(data, setId);

  if (!deck) {
    return NextResponse.json(
      { error: `Flashcard set "${setId}" not found` },
      { status: 404 },
    );
  }

  let apkg: Buffer;
  try {
    apkg = await buildApkg(deck);
  } catch (error) {
    console.error('[flashcards/download] Failed to build .apkg:', error);
    return NextResponse.json(
      { error: 'Failed to generate Anki deck' },
      { status: 500 },
    );
  }

  const apkgBytes = new Uint8Array(apkg);
  const filename = `${safeFilename(setId)}.apkg`;
  return new Response(apkgBytes, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(apkgBytes.byteLength),
      // Built deterministically from static flashcardData.json, safe to cache.
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
