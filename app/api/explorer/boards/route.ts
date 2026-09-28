import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/authSession";
import { prisma } from "@/prisma/prisma";
import { TOMBSTONE_MS, scopeSchema, type WireBoard } from "@/lib/explorer-query/board-wire";

/* GET /api/explorer/boards?scope=mainnet:c-chain
   The signed-in reader's boards for one chain, deleted ones included (as
   tombstones), so a device can drop what another device deleted. */

export async function GET(req: NextRequest) {
  const session = await getAuthSession();
  // a reader who has not accepted the terms has no account row yet
  if (!session?.user?.id || session.user.id.startsWith("pending_")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const scope = scopeSchema.safeParse(req.nextUrl.searchParams.get("scope"));
  if (!scope.success) return NextResponse.json({ error: "scope must look like mainnet:c-chain" }, { status: 400 });
  try {
    // deletes older than every device's last sync are dropped for good
    await prisma.queryBoard.deleteMany({ where: { user_id: session.user.id, deleted_at: { lt: new Date(Date.now() - TOMBSTONE_MS) } } });
    const rows = await prisma.queryBoard.findMany({
      where: { user_id: session.user.id, scope: scope.data },
      orderBy: { updated_at: "desc" },
    });
    const boards: WireBoard[] = rows.map((r) => ({
      id: r.id,
      scope: r.scope,
      name: r.name,
      tiles: Array.isArray(r.tiles) ? r.tiles : [],
      createdAt: r.created_at.getTime(),
      updatedAt: r.updated_at.getTime(),
      deletedAt: r.deleted_at?.getTime() ?? null,
    }));
    return NextResponse.json({ boards });
  } catch (error) {
    console.error("Error reading query boards:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
