import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/authSession";
import { prisma } from "@/prisma/prisma";
import { MAX_BOARDS, MAX_TILES_BYTES, boardBodySchema, boardIdSchema, withoutRows, writeAllowed, type WireBoard } from "@/lib/explorer-query/board-wire";

/* PUT /api/explorer/boards/:id    keep this board (create or replace)
   DELETE /api/explorer/boards/:id mark it deleted
   Every read and write is keyed on (the session's user, id): a reader
   only ever touches their own boards. The newer edit wins: a write older
   than the kept copy is refused with 409 and the kept copy, so the device
   can take it instead. */

type Ctx = { params: Promise<{ id: string }> };

function wire(r: { id: string; scope: string; name: string; tiles: unknown; created_at: Date; updated_at: Date; deleted_at: Date | null }): WireBoard {
  return {
    id: r.id,
    scope: r.scope,
    name: r.name,
    tiles: Array.isArray(r.tiles) ? r.tiles : [],
    createdAt: r.created_at.getTime(),
    updatedAt: r.updated_at.getTime(),
    deletedAt: r.deleted_at?.getTime() ?? null,
  };
}

/** a device clock far ahead would win every edit; hold it to now */
const clamp = (ms: number) => Math.min(ms, Date.now() + 60_000);

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getAuthSession();
  // a reader who has not accepted the terms has no account row yet
  if (!session?.user?.id || session.user.id.startsWith("pending_")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  if (!writeAllowed(userId)) return NextResponse.json({ error: "Too many writes" }, { status: 429 });
  const { id } = await params;
  if (!boardIdSchema.safeParse(id).success) return NextResponse.json({ error: "Bad board id" }, { status: 400 });

  const parsed = boardBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad board", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  const body = parsed.data;
  const tiles = body.tiles.map(withoutRows);
  if (JSON.stringify(tiles).length > MAX_TILES_BYTES) return NextResponse.json({ error: "Board is too large" }, { status: 413 });

  try {
    const where = { user_id_id: { user_id: userId, id } };
    const kept = await prisma.queryBoard.findUnique({ where });
    const updatedAt = clamp(body.updatedAt);
    if (kept) {
      const keptAt = Math.max(kept.updated_at.getTime(), kept.deleted_at?.getTime() ?? 0);
      if (keptAt > updatedAt) return NextResponse.json({ error: "A newer edit is kept", board: wire(kept) }, { status: 409 });
    } else {
      const count = await prisma.queryBoard.count({ where: { user_id: userId, deleted_at: null } });
      if (count >= MAX_BOARDS) return NextResponse.json({ error: `At most ${MAX_BOARDS} boards` }, { status: 429 });
    }
    const data = { scope: body.scope, name: body.name, tiles: tiles as object[], updated_at: new Date(updatedAt), deleted_at: null };
    const row = await prisma.queryBoard.upsert({
      where,
      create: { id, user_id: userId, created_at: new Date(clamp(body.createdAt)), ...data },
      update: data,
    });
    return NextResponse.json({ board: wire(row) });
  } catch (error) {
    console.error("Error keeping query board:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await getAuthSession();
  // a reader who has not accepted the terms has no account row yet
  if (!session?.user?.id || session.user.id.startsWith("pending_")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!writeAllowed(session.user.id)) return NextResponse.json({ error: "Too many writes" }, { status: 429 });
  const { id } = await params;
  if (!boardIdSchema.safeParse(id).success) return NextResponse.json({ error: "Bad board id" }, { status: 400 });
  const at = Number(req.nextUrl.searchParams.get("at"));
  const deletedAt = new Date(clamp(Number.isFinite(at) && at > 0 ? at : Date.now()));
  try {
    const where = { user_id_id: { user_id: session.user.id, id } };
    const kept = await prisma.queryBoard.findUnique({ where });
    if (!kept) return NextResponse.json({ ok: true });
    if (kept.updated_at > deletedAt) return NextResponse.json({ error: "A newer edit is kept", board: wire(kept) }, { status: 409 });
    // the tombstone keeps no tiles
    await prisma.queryBoard.update({ where, data: { deleted_at: deletedAt, tiles: [] } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting query board:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
