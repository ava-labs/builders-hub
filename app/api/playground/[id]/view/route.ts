import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/prisma/prisma';

/**
 * Best-effort de-duplication of view counts.
 *
 * Keyed by viewer + playground with a short window so a single reader holding
 * refresh does not run the counter up. This is deliberately in-process: the
 * count is a soft engagement signal, not something access or rewards hang on,
 * so a per-instance window is proportionate. If the count ever gains real
 * weight, this needs to move to the database with a unique
 * (playground_id, viewer, bucket) constraint — an in-memory map cannot make a
 * promise that holds across serverless instances.
 */
const VIEW_DEDUPE_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const recentViews = new Map<string, number>();
const MAX_TRACKED_VIEWS = 10_000;

function alreadyCountedRecently(key: string, now: number): boolean {
  const seenAt = recentViews.get(key);
  if (seenAt !== undefined && now - seenAt < VIEW_DEDUPE_WINDOW_MS) return true;

  // Opportunistic sweep. Without it an attacker choosing fresh keys grows this
  // map without bound, turning a cosmetic bug into a memory one.
  if (recentViews.size >= MAX_TRACKED_VIEWS) {
    for (const [k, t] of recentViews) {
      if (now - t >= VIEW_DEDUPE_WINDOW_MS) recentViews.delete(k);
    }
    if (recentViews.size >= MAX_TRACKED_VIEWS) recentViews.clear();
  }

  recentViews.set(key, now);
  return false;
}

/**
 * Cloudflare overwrites CF-Connecting-IP at the edge, so it is trustworthy for
 * requests that actually traverse it — but only those. Everything else here is
 * client-settable, which is why this value is used purely to spread out
 * de-duplication and never to authorise anything.
 */
function viewerKey(req: NextRequest): string {
  return req.headers.get('cf-connecting-ip')?.trim() || 'unknown';
}

// POST /api/playground/[id]/view - Increment view count
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: playgroundId } = await params;

    if (!playgroundId) {
      return NextResponse.json({ error: 'Playground ID is required' }, { status: 400 });
    }

    // Only public playgrounds accrue views. The previous version incremented
    // any id it was handed, so the endpoint doubled as a probe for whether a
    // private playground existed.
    const playground = await prisma.statsPlayground.findUnique({
      where: { id: playgroundId },
      select: { is_public: true },
    });

    if (!playground?.is_public) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (alreadyCountedRecently(`${viewerKey(req)}:${playgroundId}`, Date.now())) {
      const current = await prisma.statsPlayground.findUnique({
        where: { id: playgroundId },
        select: { view_count: true },
      });
      return NextResponse.json({ success: true, view_count: current?.view_count ?? 0, counted: false });
    }

    // Increment view count atomically
    const updated = await prisma.statsPlayground.update({
      where: { id: playgroundId },
      data: {
        view_count: {
          increment: 1
        }
      },
      select: {
        view_count: true
      }
    });

    return NextResponse.json({
      success: true,
      view_count: updated.view_count,
      counted: true
    });
  } catch (error) {
    console.error('Error incrementing view count:', error);
    // Don't fail the request if view tracking fails
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to track view' 
    }, { status: 500 });
  }
}
