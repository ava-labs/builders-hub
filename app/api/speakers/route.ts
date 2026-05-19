import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getUserById } from "@/server/services/getUser";
import { AuthOptions } from "@/lib/auth/authOptions";

const prisma: PrismaClient = new PrismaClient();

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getServerSession(AuthOptions);

    if (!session?.user?.id || typeof session.user.id !== "string") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId: string = session.user.id;
    const user = await getUserById(userId);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const customAttributes: string[] = user.custom_attributes || [];

    const allowedRoles = new Set(["devrel", "team1-admin", "hackathonCreator"]);

    const hasAccess = customAttributes.some((role) => allowedRoles.has(role));

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const speakers = await prisma.speaker.findMany();

    return NextResponse.json(speakers, { status: 200 });
  } catch (error: unknown) {
    console.error("Error GET /api/speakers:", error);

    return NextResponse.json(
      { error: "Error fetching speakers" },
      { status: 500 },
    );
  }
}
