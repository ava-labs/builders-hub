/* The shape a board takes between a device and the account. Rows never
   travel: a tile's snapshot stays on the device that read it, and every
   other device runs the SQL again. Shared by the API routes and the sync. */

import { z } from "zod";
import { visualSpecSchema } from "./visual";

export const MAX_TILES = 40;
export const MAX_BOARDS = 200;
/** the JSON of one board's tiles, snapshots removed */
export const MAX_TILES_BYTES = 256 * 1024;

export const scopeSchema = z.string().regex(/^(mainnet|fuji|testnet):[a-z0-9-]{1,40}$/);
export const boardIdSchema = z.string().regex(/^[A-Za-z0-9_-]{6,40}$/);

const base = { id: z.string().max(40), order: z.number(), size: z.enum(["s", "m", "l", "w"]) };

/* a chart tile's layout is checked against the designer's own grammar,
   which also fills its defaults; fields the board does not use are dropped */
const tileSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("note"), text: z.string().max(4000), ...base }),
  z.object({
    kind: z.literal("chart"),
    question: z.string().max(2000),
    title: z.string().max(200),
    sql: z.string().max(20_000),
    visual: visualSpecSchema,
    panelIndex: z.number().int().min(0).nullable(),
    view: z.enum(["hbar", "bar", "line", "area", "scatter", "table"]).optional(),
    ...base,
  }),
]);

/** a deleted board's row is kept this long, for the reader's other devices */
export const TOMBSTONE_MS = 30 * 24 * 3600 * 1000;

/* writes per reader, per server instance: a sync sends a board a second
   after an edit, so a person stays far below this; a loop does not */
const WRITES_PER_MIN = 120;
const writes = new Map<string, number[]>();
export function writeAllowed(userId: string): boolean {
  const now = Date.now();
  const recent = (writes.get(userId) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= WRITES_PER_MIN) return false;
  recent.push(now);
  writes.set(userId, recent);
  if (writes.size > 5000) writes.clear();
  return true;
}

export const boardBodySchema = z.object({
  scope: scopeSchema,
  name: z.string().trim().min(1).max(80),
  tiles: z.array(tileSchema).max(MAX_TILES),
  /** unix ms; the newer edit wins */
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});
export type BoardBody = z.infer<typeof boardBodySchema>;

/** a board as the account keeps it */
export interface WireBoard {
  id: string;
  scope: string;
  name: string;
  tiles: unknown[];
  createdAt: number;
  updatedAt: number;
  /** unix ms, set when the board was deleted on some device */
  deletedAt: number | null;
}

/** a tile without the rows it read */
export function withoutRows<T extends { kind: string }>(tile: T): Omit<T, "snapshot"> {
  if (tile.kind !== "chart") return tile;
  const { snapshot: _rows, ...rest } = tile as T & { snapshot?: unknown };
  void _rows;
  return rest;
}
