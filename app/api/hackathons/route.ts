import { NextRequest, NextResponse } from 'next/server';
import {
  createHackathon,
  getFilteredHackathons,
  GetHackathonsOptions,
} from '@/server/services/hackathons';
import { HackathonStatus } from '@/types/hackathons';
import { getUserById } from '@/server/services/getUser';
import { env } from 'process';



export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const userId = req.headers.get("id");
    
    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }
    
    // Get user from database to validate permissions
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    // Check user's custom_attributes for permissions
    const customAttributes = user.custom_attributes || [];
    const isDevrel = customAttributes.includes("devrel");
    const isTeam1Admin = customAttributes.includes("team1-admin");
    const isHackathonCreator = customAttributes.includes("hackathonCreator");
    
    // If user is devrel, show all hackathons; otherwise filter by user ID
    const createdByFilter = isDevrel ? undefined : userId;
    
    const options: GetHackathonsOptions = {
      page: Number(searchParams.get('page') || 1),
      pageSize: Number(searchParams.get('pageSize') || 10),
      location: searchParams.get('location') || undefined,
      date: searchParams.get('date') || undefined,
      status: searchParams.get('status') as HackathonStatus || undefined,
      search: searchParams.get('search') || undefined,
      created_by: createdByFilter || undefined,
      include_private: isDevrel || isTeam1Admin || isHackathonCreator, // These roles can see private hackathons
    };
    
    console.log('API GET /hackathons:', { userId, isDevrel, isTeam1Admin, isHackathonCreator, createdByFilter, options });
    const response = await getFilteredHackathons(options);

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error GET /api/hackathons:', error.message);
    const wrappedError = error as Error;
    return NextResponse.json(
      { error: wrappedError.message },
      { status: wrappedError.cause == 'BadRequest' ? 400 : 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (req.headers.get("x-api-key") != env.APIKEY)
      throw new Error('Unauthorized')
    const body = await req.json();
    const newHackathon = await createHackathon(body);

    return NextResponse.json(
      { message: 'Hackathon created', hackathon: newHackathon },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error POST /api/hackathons:', error.message);
    const wrappedError = error as Error;
    return NextResponse.json(
      { error: wrappedError },
      { status: wrappedError.cause == 'ValidationError' ? 400 : 500 }
    );
  }
}

