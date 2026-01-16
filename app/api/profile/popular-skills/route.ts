import { NextRequest, NextResponse } from 'next/server';
import { getPopularSkills } from '@/server/services/profile/profile.service';
import { withAuth } from '@/lib/protectedRoute';


export const GET = withAuth(async (req: NextRequest, session: any) => {
    try {
        const popularSkills = await getPopularSkills();
        return NextResponse.json(popularSkills, {
            status: 200, headers: {
                'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
            }
        });
    } catch (error) {
        console.error('Error in GET /api/profile/popular-skills:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
});

