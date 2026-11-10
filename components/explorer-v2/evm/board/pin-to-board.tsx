"use client";

/* The pin control: an answer, or one panel of it, onto a board the
   reader picks or makes. */

import { useMemo, useState } from "react";
import Link from "next/link";
import * as Popover from "@radix-ui/react-popover";
import { ArrowUpRight, Check, CornerDownRight, Pin, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { boardHref, boardScope, pinAnswer, useBoards, type Board } from "@/lib/explorer-query/board";
import type { QueryAnswer } from "@/lib/explorer-query/types";
import { BoardThumb, Label } from "@/components/explorer-v2/evm/query-board-bits";

/** pin an answer, or one of its panels, to a board: pick one or make one */
export function PinToBoard({
  chain,
  network,
  answer,
  panelIndex,
  thread,
  className,
}: {
  /** the chain slug: "c-chain", "p-chain" */
  chain: string;
  network: string;
  answer: QueryAnswer;
  /** one panel of the answer; omit to pin the whole answer with its figures */
  panelIndex?: number;
  /** the question and its follow-ups as asked, so Open asks the same thread; defaults to the title */
  thread?: string[];
  className?: string;
}) {
  const { boards, create, addTile } = useBoards(boardScope(network, chain));
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [done, setDone] = useState<{ id: string; name: string } | null>(null);
  const key = thread?.join("\n");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tile = useMemo(() => pinAnswer(answer, { panelIndex, thread }), [answer, panelIndex, key]);

  const pinTo = (b: Board) => {
    if (!tile) return;
    addTile(b.id, tile);
    setDone({ id: b.id, name: b.name });
  };
  const pinNew = () => {
    if (!tile) return;
    const b = create(name.trim() || answer.title.slice(0, 60) || "Untitled board", [tile]);
    setDone({ id: b.id, name: b.name });
  };

  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setDone(null);
          setNaming(false);
          setName("");
        }
      }}
    >
      <Popover.Trigger
        disabled={!tile}
        aria-label={panelIndex === undefined ? "Pin this answer to a board" : "Pin this chart to a board"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 data-[state=open]:bg-zinc-100 data-[state=open]:text-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 dark:data-[state=open]:bg-zinc-900 dark:data-[state=open]:text-zinc-100",
          className,
        )}
      >
        <Pin className="h-3 w-3" /> Pin
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-72 overflow-hidden rounded-2xl border border-zinc-200 bg-white/95 p-1.5 shadow-[0_24px_48px_-20px_rgba(24,24,27,0.4)] backdrop-blur-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 dark:border-zinc-800 dark:bg-zinc-950/95"
        >
          {done ? (
            <div className="flex flex-col gap-3 p-3">
              <span className="flex items-center gap-2 text-[14px] text-zinc-900 dark:text-zinc-50">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <span className="min-w-0 truncate">
                  Pinned to <span className="font-medium">{done.name}</span>
                </span>
              </span>
              <Link
                href={boardHref(network, chain, done.id)}
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center gap-1.5 rounded-full bg-zinc-900 px-3 py-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.12em] text-zinc-50 transition-opacity hover:opacity-85 dark:bg-zinc-50 dark:text-zinc-900"
              >
                View board <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <div className="flex flex-col">
              <Label className="px-2.5 pb-1.5 pt-2">Pin to a board</Label>
              <div className="flex max-h-64 flex-col overflow-y-auto">
                {boards.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => pinTo(b)}
                    className="group flex items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  >
                    <span className="h-8 w-12 shrink-0 overflow-hidden rounded-md bg-zinc-50 p-1 dark:bg-zinc-900">
                      <BoardThumb board={b} className="auto-rows-[0.35rem] gap-[2px]" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13.5px] text-zinc-900 dark:text-zinc-50">{b.name}</span>
                      <span className="font-mono text-[10px] text-zinc-400">
                        {b.tiles.length} {b.tiles.length === 1 ? "tile" : "tiles"}
                      </span>
                    </span>
                    <Plus className="h-3.5 w-3.5 text-zinc-300 transition-colors group-hover:text-zinc-900 dark:text-zinc-700 dark:group-hover:text-zinc-100" />
                  </button>
                ))}
              </div>
              {boards.length > 0 && <div className="mx-2 my-1 h-px bg-zinc-100 dark:bg-zinc-900" />}
              {naming ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    pinNew();
                  }}
                  className="flex items-center gap-2 p-1.5"
                >
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={answer.title.slice(0, 60) || "Board name"}
                    className="min-w-0 flex-1 rounded-lg bg-zinc-50 px-2.5 py-1.5 text-[13.5px] text-zinc-900 outline-none ring-1 ring-zinc-200 placeholder:text-zinc-400 focus:ring-zinc-400 dark:bg-zinc-900 dark:text-zinc-50 dark:ring-zinc-800"
                  />
                  <button type="submit" className="rounded-lg bg-zinc-900 px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900">
                    Create
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setNaming(true)}
                  className="flex items-center gap-3 rounded-xl px-2.5 py-2 text-left text-[13.5px] text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
                >
                  <span className="flex h-8 w-12 shrink-0 items-center justify-center rounded-md border border-dashed border-zinc-300 dark:border-zinc-700">
                    <CornerDownRight className="h-3.5 w-3.5" />
                  </span>
                  New board
                </button>
              )}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
