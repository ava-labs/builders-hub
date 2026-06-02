import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { getUserById } from "@/server/services/getUser";
import { AuthOptions } from "@/lib/auth/authOptions";
import { prisma } from "@/prisma/prisma";

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

    const allowedRoles: Set<string> = new Set([
      "devrel",
      "team1-admin",
      "hackathonCreator",
    ]);

    const hasAccess: boolean = customAttributes.some(
      (role: string): boolean => allowedRoles.has(role),
    );

    if (!hasAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const resources = await prisma.resource.findMany();

    return NextResponse.json(resources, { status: 200 });
  } catch (error: unknown) {
    console.error("Error GET /api/resources:", error);

    return NextResponse.json(
      { error: "Error fetching resources" },
      { status: 500 },
    );
  }
}