import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/prisma/prisma';

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

    // Increment view count atomically
    const playground = await prisma.statsPlayground.update({
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
      view_count: playground.view_count 
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

