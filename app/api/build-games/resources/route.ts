import { NextResponse } from 'next/server';
import { getHackathon } from '@/server/services/hackathons';

const HACKATHON_ID = "249d2911-7931-4aa0-a696-37d8370b79f9";

export async function GET() {
  try {
    const hackathon = await getHackathon(HACKATHON_ID);

    if (!hackathon?.content?.resources) {
      return NextResponse.json({ resources: [] });
    }

    return NextResponse.json({ resources: hackathon.content.resources });
  } catch (error) {
    console.error('Error fetching resources:', error);
    return NextResponse.json({ resources: [] });
  }
}
