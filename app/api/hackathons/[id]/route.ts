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
    const updateData = await req.json();
    const userId = req.headers.get("id");
    if (updateData.hasOwnProperty('is_public') && typeof updateData.is_public === 'boolean' && Object.keys(updateData).length === 1) {
      const updatedHackathon = await updateHackathon(id, { is_public: updateData.is_public }, userId || undefined);
      return NextResponse.json(updatedHackathon);
    } else {
      const partialEditedHackathon = updateData as Partial<HackathonHeader>;
      const updatedHackathon = await updateHackathon(partialEditedHackathon.id ?? id, partialEditedHackathon, userId || undefined);
      return NextResponse.json(updatedHackathon);
    }
  } catch (error) {
    console.error("Error in PUT /api/hackathons/[id]:", error);
    return NextResponse.json({ error: `Internal Server Error: ${error}` }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: any) {
  try {
    if (req.headers.get("x-api-key") != env.APIKEY)
      throw new Error('Unauthorized')
    
    const { id } = await context.params;
    const updateData = await req.json();
    const userId = req.headers.get("id");

    if (updateData.hasOwnProperty('is_public') && typeof updateData.is_public === 'boolean') {
      const updatedHackathon = await updateHackathon(id, { is_public: updateData.is_public }, userId || undefined);
      return NextResponse.json(updatedHackathon);
    } else {
      return NextResponse.json({ error: "Only is_public field can be updated via PATCH" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in PATCH /api/hackathons/[id]:", error);
    return NextResponse.json({ error: `Internal Server Error: ${error}` }, { status: 500 });
  }
}
