"use client";

/* A tile's controls: the corner that resizes it, its menu and its grip. */

import Link from "next/link";
import { ArrowUpRight, Copy, Download, GripVertical, ImageDown, MoreHorizontal, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SIZE_LABEL, TILE_SIZES, askHref, nextSize, type Tile, type TileSize } from "@/lib/explorer-query/board";
import { METRIC_WINDOWS, windowText } from "@/lib/explorer-query/stats-metrics";
import { iconBtn, type Handle, type TileCtx } from "./parts";

export function SizeHandle({ size, onSize }: { size: TileSize; onSize: (s: TileSize) => void }) {
  const next = nextSize(size);
  return (
    <button
      type="button"
      onClick={() => onSize(next)}
      title={`${SIZE_LABEL[size]}. Click for ${SIZE_LABEL[next].toLowerCase()}`}
      aria-label={`Resize tile to ${SIZE_LABEL[next].toLowerCase()}`}
      data-no-shot
      className="absolute bottom-1.5 right-1.5 hidden h-6 w-6 items-center justify-center rounded-md text-zinc-300 opacity-0 transition-opacity hover:text-zinc-900 focus-visible:opacity-100 group-hover/tile:opacity-100 md:flex dark:text-zinc-700 dark:hover:text-zinc-100"
    >
      <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden>
        <path d="M11 4 L4 11 M11 8 L8 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    </button>
  );
}

export function TileMenu({
  tile,
  ctx,
  onRename,
  onEdit,
  onCsv,
  onPng,
}: {
  tile: Tile;
  ctx: TileCtx;
  onRename?: () => void;
  onEdit?: () => void;
  /** the tile's rows as a file; given once the tile holds rows */
  onCsv?: () => void;
  /** the tile's drawing as an image; given once the tile holds rows */
  onPng?: () => void;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className={iconBtn} aria-label="Tile options" data-no-shot>
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 font-mono text-[12px]">
        {tile.kind === "chart" && (
          <DropdownMenuItem asChild>
            <Link href={askHref(ctx.network, ctx.chainSlug, tile.question, tile.then)}>
              <ArrowUpRight className="h-3.5 w-3.5" /> Open in Query
            </Link>
          </DropdownMenuItem>
        )}
        {onRename && <DropdownMenuItem onSelect={onRename}>Rename</DropdownMenuItem>}
        {onEdit && <DropdownMenuItem onSelect={onEdit}>Edit text</DropdownMenuItem>}
        <DropdownMenuItem onSelect={() => ctx.api.duplicateTile(ctx.boardId, tile.id)}>
          <Copy className="h-3.5 w-3.5" /> Duplicate
        </DropdownMenuItem>
        {onCsv && (
          <DropdownMenuItem onSelect={onCsv}>
            <Download className="h-3.5 w-3.5" /> Download CSV
          </DropdownMenuItem>
        )}
        {onPng && (
          <DropdownMenuItem onSelect={onPng}>
            <ImageDown className="h-3.5 w-3.5" /> Download PNG
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {tile.kind === "metric" && (
          <>
            <DropdownMenuLabel className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-zinc-400">Days</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={tile.from && tile.to ? "dates" : String(tile.days ?? "all")}
              onValueChange={(v) => {
                if (v !== "dates") ctx.api.updateTile(ctx.boardId, tile.id, { days: v === "all" ? null : Number(v), from: null, to: null });
              }}
            >
              {tile.from && tile.to && <DropdownMenuRadioItem value="dates">{windowText(tile)}</DropdownMenuRadioItem>}
              {METRIC_WINDOWS.map((d) => (
                <DropdownMenuRadioItem key={d ?? "all"} value={String(d ?? "all")}>
                  {windowText({ days: d })}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-zinc-400">Width</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={tile.size} onValueChange={(v) => ctx.api.updateTile(ctx.boardId, tile.id, { size: v as TileSize })}>
          {TILE_SIZES.map((s) => (
            <DropdownMenuRadioItem key={s} value={s}>
              {SIZE_LABEL[s]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => ctx.api.removeTile(ctx.boardId, tile.id)} className="text-[#E6212F] focus:text-[#E6212F]">
          <Trash2 className="h-3.5 w-3.5" /> Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Grip({ handle }: { handle?: Handle }) {
  return (
    <button
      type="button"
      ref={handle?.ref}
      {...handle?.props}
      aria-label="Drag to move"
      data-no-shot
      className="-ml-1.5 flex h-7 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded text-zinc-300 transition-colors hover:text-zinc-600 active:cursor-grabbing md:opacity-0 md:group-hover/tile:opacity-100 md:focus-visible:opacity-100 dark:text-zinc-700 dark:hover:text-zinc-300"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}
