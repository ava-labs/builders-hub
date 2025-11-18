import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/authSession';
import { prisma } from '@/prisma/prisma';

// GET /api/playground - Get user's playgrounds
export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    const { searchParams } = new URL(req.url);
    const playgroundId = searchParams.get('id');
    const includePublic = searchParams.get('includePublic') === 'true';

    if (playgroundId) {
      // Get specific playground - allow public access even without auth
      const playground = await prisma.playground.findFirst({
        where: {
          id: playgroundId,
          OR: session?.user ? [
            { user_id: session.user.id },
            { is_public: true }
          ] : [
            { is_public: true }
          ]
        },
        include: {
          favorites: session?.user ? {
            where: {
              user_id: session.user.id
            }
          } : false,
          _count: {
            select: { favorites: true }
          },
          user: {
            select: {
              id: true,
              name: true,
              user_name: true,
              image: true,
              profile_privacy: true
            }
          }
        }
      });

      if (!playground) {
        return NextResponse.json({ error: 'Playground not found' }, { status: 404 });
      }

      const isOwner = session?.user ? playground.user_id === session.user.id : false;
      const isFavorited = session?.user && playground.favorites ? playground.favorites.length > 0 : false;
      const favoriteCount = playground._count.favorites;

      return NextResponse.json({
        ...playground,
        is_owner: isOwner,
        is_favorited: isFavorited,
        favorite_count: favoriteCount,
        favorites: undefined, // Remove favorites array from response
        _count: undefined, // Remove _count from response
        creator: playground.user ? {
          id: playground.user.id,
          name: playground.user.name,
          user_name: playground.user.user_name,
          image: playground.user.image,
          profile_privacy: playground.user.profile_privacy
        } : undefined
      });
    }

    // Get all user's playgrounds - requires authentication
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized, please sign in to continue.' }, { status: 401 });
    }
    
    const where: any = { user_id: session.user.id };
    
    if (includePublic) {
      const playgrounds = await prisma.playground.findMany({
        where: {
          OR: [
            { user_id: session.user.id },
            { is_public: true }
          ]
        },
        orderBy: { updated_at: 'desc' },
        take: 100
      });
      return NextResponse.json(playgrounds);
    }

    const playgrounds = await prisma.playground.findMany({
      where,
      orderBy: { updated_at: 'desc' },
      take: 100
    });

    return NextResponse.json(playgrounds);
  } catch (error) {
    console.error('Error fetching playgrounds:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/playground - Create new playground
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized, please sign in to continue.' }, { status: 401 });
    }

    const body = await req.json();
    if (!body) {
      return NextResponse.json({ error: 'No body provided.' }, { status: 400 });
    }

    if (!body.name) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    }

    const { name, isPublic, charts } = body;

    const playground = await prisma.playground.create({
      data: {
        user_id: session.user.id,
        name,
        is_public: isPublic || false,
        charts: charts || []
      }
    });

    return NextResponse.json(playground);
  } catch (error) {
    console.error('Error creating playground:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/playground - Update existing playground
export async function PUT(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized, please sign in to continue.' }, { status: 401 });
    }

    const body = await req.json();
    if (!body || !body.id) {
      return NextResponse.json({ error: 'Playground ID is required.' }, { status: 400 });
    }

    const { id, name, isPublic, charts } = body;

    // Verify ownership
    const existing = await prisma.playground.findFirst({
      where: {
        id,
        user_id: session.user.id
      }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Playground not found or unauthorized' }, { status: 404 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (isPublic !== undefined) updateData.is_public = isPublic;
    if (charts !== undefined) updateData.charts = charts;

    const playground = await prisma.playground.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json(playground);
  } catch (error) {
    console.error('Error updating playground:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/playground - Delete playground
export async function DELETE(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized, please sign in to continue.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Playground ID is required.' }, { status: 400 });
    }

    // Verify ownership
    const existing = await prisma.playground.findFirst({
      where: {
        id,
        user_id: session.user.id
      }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Playground not found or unauthorized' }, { status: 404 });
    }

    await prisma.playground.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting playground:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

