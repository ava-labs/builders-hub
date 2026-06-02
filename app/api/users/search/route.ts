import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/prisma";
import { withAuth } from "@/lib/protectedRoute";

const MAX_RESULTS = 20;

export const GET = withAuth(async (request: NextRequest, _context, session) => {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const requestedScope = url.searchParams.get("scope");
  const scope: "public" | "admin" = requestedScope === "admin" ? "admin" : "public";

  if (q.length < 2) {
    return NextResponse.json({ users: [] });
  }

  if (scope === "admin") {
    const isDevrel = session.user?.custom_attributes?.includes("devrel") ?? false;
    if (!isDevrel) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const orClauses: Prisma.UserWhereInput[] = [
    { name: { contains: q, mode: "insensitive" } },
    { user_name: { contains: q, mode: "insensitive" } },
  ];
  if (scope === "admin") {
    orClauses.push({ email: { contains: q, mode: "insensitive" } });
  }

  const where: Prisma.UserWhereInput =
    scope === "admin"
      ? { OR: orClauses }
      : {
          AND: [
            { OR: orClauses },
            { OR: [{ profile_privacy: "public" }, { profile_privacy: null }] },
          ],
        };

  if (scope === "admin") {
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        user_name: true,
        custom_attributes: true,
      },
      orderBy: { name: "asc" },
      take: MAX_RESULTS,
    });
    return NextResponse.json({ users });
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      image: true,
      user_name: true,
    },
    orderBy: { name: "asc" },
    take: MAX_RESULTS,
  });
  return NextResponse.json({ users });
});
