import { NextRequest, NextResponse } from 'next/server';
import {
  createHackathon,
  getFilteredHackathons,
  GetHackathonsOptions,
} from '@/server/services/hackathons';
import { PrismaClient } from '@prisma/client';
import { HackathonStatus } from '@/types/hackathons';
import { env } from 'process';

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const options: GetHackathonsOptions = {
      page: Number(searchParams.get('page') || 1),
      pageSize: Number(searchParams.get('pageSize') || 10),
      location: searchParams.get('location') || undefined,
      date: searchParams.get('date') || undefined,
      status: searchParams.get('status') as HackathonStatus || undefined,
      search: searchParams.get('search') || undefined,
    };
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

