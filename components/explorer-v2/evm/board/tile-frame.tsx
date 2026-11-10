"use client";

/* A tile on the canvas: its card, and the card as a thing to drag. */

import { motion } from "framer-motion";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { Tile, TileSize } from "@/lib/explorer-query/board";
import type { Handle, TileCtx } from "./parts";
import { ChartTileCard, MetricTileCard, NoteTileCard } from "./tile-cards";
import { SizeHandle } from "./tile-menu";

/* spans per width: a phone stacks, a tablet pairs, a desk uses all 12 */
export const SPAN: Record<TileSize, string> = {
  s: "md:col-span-6 xl:col-span-4",
  m: "md:col-span-6",
  l: "md:col-span-12 xl:col-span-8",
  w: "md:col-span-12",
};

export function TileFrame({
  tile,
  ctx,
  handle,
  overlay,
  editing,
  onEditing,
  refreshSignal,
}: {
  tile: Tile;
  ctx: TileCtx;
  handle?: Handle;
  overlay?: boolean;
  editing: boolean;
  onEditing: (on: boolean) => void;
  refreshSignal: number;
}) {
  return (
    <motion.div
      layout={!overlay}
      layoutDependency={tile.size}
      // the card a tile's image is made of (tile-export.ts)
      data-tile
      transition={{ type: "spring", stiffness: 420, damping: 40 }}
      className={cn(
        "group/tile relative flex h-full min-w-0 flex-col gap-3 rounded-2xl p-4 transition-shadow duration-200",
        tile.kind === "note"
          ? "border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800"
          : "border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(24,24,27,0.04)] dark:border-zinc-800 dark:bg-zinc-950",
        overlay && "cursor-grabbing border-zinc-300 bg-white shadow-[0_24px_48px_-16px_rgba(24,24,27,0.35),0_4px_12px_-4px_rgba(24,24,27,0.12)] dark:border-zinc-700 dark:bg-zinc-950 dark:shadow-[0_24px_48px_-16px_rgba(0,0,0,0.8)]",
      )}
    >
      {tile.kind === "chart" ? (
        <ChartTileCard tile={tile} ctx={ctx} handle={handle} overlay={overlay} refreshSignal={refreshSignal} />
      ) : tile.kind === "metric" ? (
        <MetricTileCard tile={tile} ctx={ctx} handle={handle} overlay={overlay} refreshSignal={refreshSignal} />
      ) : (
        <NoteTileCard tile={tile} ctx={ctx} handle={handle} editing={editing && !overlay} onEditing={onEditing} />
      )}
      {!overlay && !ctx.readOnly && <SizeHandle size={tile.size} onSize={(s) => ctx.api.updateTile(ctx.boardId, tile.id, { size: s })} />}
    </motion.div>
  );
}

export function SortableTile(props: { tile: Tile; ctx: TileCtx; editing: boolean; onEditing: (on: boolean) => void; refreshSignal: number }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: props.tile.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("col-span-1 min-w-0", SPAN[props.tile.size], isDragging && "opacity-30")}
    >
      <TileFrame {...props} handle={{ ref: setActivatorNodeRef, props: { ...attributes, ...listeners } }} />
    </div>
  );
}
