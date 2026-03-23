import { NextResponse } from 'next/server';
import { getUserById } from '@/server/services/getUser';
import { withAuth } from '@/lib/protectedRoute';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export const GET = withAuth(
  async (_request: Request, { params }: RouteContext) => {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Id parameter is required' },
        { status: 400 }
      );
    }

    try {
      const user = await getUserById(id);

      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ user });
    } catch (error: unknown) {
      console.error('Error getting user by id:', error);

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
);