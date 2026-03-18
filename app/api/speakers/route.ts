import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUserById } from "@/server/services/getUser";

const prisma: PrismaClient = new PrismaClient();

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET ?? "",
    });

    if (!token?.id || typeof token.id !== "string") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId: string = token.id;
    const user = await getUserById(userId);

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const customAttributes: string[] = user.custom_attributes || [];

    const isDevrel: boolean = customAttributes.includes("devrel");
    const isTeam1Admin: boolean = customAttributes.includes("team1-admin");
    const isHackathonCreator: boolean = customAttributes.includes("hackathonCreator");

    if (!isDevrel && !isTeam1Admin && !isHackathonCreator) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const speakers = await prisma.speaker.findMany();

    return NextResponse.json(speakers, { status: 200 });
  } catch (error: unknown) {
    console.error("Error GET /api/speakers:", error);

    return NextResponse.json(
      { error: "Error fetching speakers" },
      { status: 500 }
    );
  }
}