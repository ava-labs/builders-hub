import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { AuthOptions } from "@/lib/auth/authOptions";
import { hasPermission } from "@/lib/auth/roles";
import { prisma } from "@/prisma/prisma";

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getServerSession(AuthOptions);

    if (!session?.user?.id || typeof session.user.id !== "string") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const customAttributes: string[] = session.user.custom_attributes ?? [];

    if (!hasPermission(customAttributes, { resource: "speaker", action: "read" })) {
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
