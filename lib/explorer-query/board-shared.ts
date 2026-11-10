import "server-only";
import { cache } from "react";
import { prisma } from "@/prisma/prisma";
import { boardIdSchema, type SharedBoard } from "./board-wire";

/* A board kept by an account opens for anyone with its link. Ids are
   random, and a write never takes an id another account holds (the PUT
   route refuses it), so one live row answers an id; should two ever
   answer, neither is shown. Read once per request: the page's metadata
   and the page itself share the read. */
export const sharedBoard = cache(async (id: string): Promise<SharedBoard | null> => {
  if (!boardIdSchema.safeParse(id).success) return null;
  try {
    const rows = await prisma.queryBoard.findMany({
      where: { id, deleted_at: null },
      select: { id: true, scope: true, name: true, tiles: true, created_at: true, updated_at: true },
      take: 2,
    });
    if (rows.length !== 1) return null;
    const r = rows[0];
    return {
      id: r.id,
      scope: r.scope,
      name: r.name,
      tiles: Array.isArray(r.tiles) ? r.tiles : [],
      createdAt: r.created_at.getTime(),
      updatedAt: r.updated_at.getTime(),
    };
  } catch (error) {
    // the page stands without it: the reader's own board, or "no board at this link"
    console.warn("shared query board: read failed:", error instanceof Error ? error.message.split("\n").filter(Boolean).pop() : error);
    return null;
  }
});
