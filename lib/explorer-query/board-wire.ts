/* The shape a board takes between a device and the account. Rows never
   travel: a tile's snapshot stays on the device that read it, and every
   other device runs the SQL again. Shared by the API routes and the sync. */

import { z } from "zod";

export const MAX_TILES = 40;
export const MAX_BOARDS = 200;
/** the JSON of one board's tiles, snapshots removed */
export const MAX_TILES_BYTES = 256 * 1024;

export const scopeSchema = z.string().regex(/^(mainnet|fuji|testnet):[a-z0-9-]{1,40}$/);
export const boardIdSchema = z.string().regex(/^[A-Za-z0-9_-]{6,40}$/);

const tileSchema = z
  .object({
    kind: z.enum(["chart", "note"]),
    id: z.string().max(40),
    order: z.number(),
    size: z.enum(["s", "m", "l", "w"]),
  })
  .passthrough();

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
