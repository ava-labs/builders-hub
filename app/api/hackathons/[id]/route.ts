import { NextRequest, NextResponse } from "next/server";
import { getHackathon, updateHackathon } from "@/server/services/hackathons";
import { HackathonHeader } from "@/types/hackathons";
import { env } from "process";

export async function GET(req: NextRequest, context: any) {

  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const hackathon = await getHackathon(id)
    return NextResponse.json(hackathon);
  } catch (error) {
    console.error("Error in GET /api/hackathons/[id]:");
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, context: any) {
  try {
    if (req.headers.get("x-api-key") != env.APIKEY)
      throw new Error('Unauthorized')
    const { id } = await context.params;
    const partialEditedHackathon = (await req.json()) as Partial<HackathonHeader>;

    const updatedHackathon = await updateHackathon(partialEditedHackathon.id ?? id, partialEditedHackathon);

    return NextResponse.json(updatedHackathon);
  } catch (error) {
    console.error("Error in PUT /api/hackathons/[id]:", error);
    return NextResponse.json({ error: `Internal Server Error: ${error}` }, { status: 500 });
  }
}
