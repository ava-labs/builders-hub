import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/authSession';
import { prisma } from '@/prisma/prisma';

// POST /api/playground/favorite - Favorite a playground
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized, please sign in to continue.' }, { status: 401 });
    }

    const body = await req.json();
    const { playgroundId } = body;

    if (!playgroundId) {
      return NextResponse.json({ error: 'Playground ID is required.' }, { status: 400 });
    }

    // Verify playground exists and is public or owned by user
    const playground = await prisma.statsPlayground.findFirst({
      where: {
        id: playgroundId,
        OR: [
          { user_id: session.user.id },
          { is_public: true }
        ]
      }
    });

    if (!playground) {
      return NextResponse.json({ error: 'Playground not found' }, { status: 404 });
    }

    // Check if already favorited
    const existingFavorite = await prisma.statsPlaygroundFavorite.findUnique({
      where: {
        playground_id_user_id: {
          playground_id: playgroundId,
          user_id: session.user.id
        }
      }
    });

    if (existingFavorite) {
      return NextResponse.json({ error: 'Playground already favorited' }, { status: 400 });
    }

    // Create favorite
    await prisma.statsPlaygroundFavorite.create({
      data: {
        playground_id: playgroundId,
        user_id: session.user.id
      }
    });

    // Get updated favorite count
    const favoriteCount = await prisma.statsPlaygroundFavorite.count({
      where: { playground_id: playgroundId }
    });

    return NextResponse.json({ 
      success: true,
      favorite_count: favoriteCount 
    });
  } catch (error) {
    console.error('Error favoriting playground:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/playground/favorite - Unfavorite a playground
export async function DELETE(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized, please sign in to continue.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const playgroundId = searchParams.get('playgroundId');

    if (!playgroundId) {
      return NextResponse.json({ error: 'Playground ID is required.' }, { status: 400 });
    }

    // Delete favorite
    await prisma.statsPlaygroundFavorite.deleteMany({
      where: {
        playground_id: playgroundId,
        user_id: session.user.id
      }
    });

    // Get updated favorite count
    const favoriteCount = await prisma.statsPlaygroundFavorite.count({
      where: { playground_id: playgroundId }
    });

    return NextResponse.json({ 
      success: true,
      favorite_count: favoriteCount 
    });
  } catch (error) {
    console.error('Error unfavoriting playground:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

