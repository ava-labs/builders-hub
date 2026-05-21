import { NextRequest, NextResponse } from 'next/server';
import { Session } from 'next-auth';
import { getPopularSkills } from '@/server/services/profile/profile.service';
import { withAuth } from '@/lib/protectedRoute';

export const GET = withAuth(async (req: NextRequest, _context: unknown, session: Session) => {
    try {
        const popularSkills = await getPopularSkills();
        return NextResponse.json(popularSkills, {
            status: 200, headers: {
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            }
        });
    } catch (error) {
        console.error('Error in GET /api/profile/popular-skills:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
});

