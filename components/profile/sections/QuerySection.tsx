"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { askHref } from "@/lib/explorer-query/board-links";
import type { ProfileBoard, ProfileBoards } from "@/server/services/query-boards";
import { EmptyState, ErrorLine, FOCUS, Group, LinkButton, SectionHeader, SkeletonRows, Stack } from "../ui";
import { formatDay } from "./format";

const QUERY_HREF = askHref("mainnet", "c-chain");

type Load = { status: "loading" } | { status: "error" } | { status: "ready"; boards: ProfileBoard[] };

function chartCount(n: number): string {
  return `${n} chart${n === 1 ? "" : "s"}`;
}

function BoardRow({ board }: { board: ProfileBoard }) {
  const day = formatDay(board.updatedAt);
  const meta = [board.chainLabel, board.networkLabel, chartCount(board.charts)];
  return (
    <li>
      <Link
        href={board.href}
        className={cn(
          "group flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-zinc-50 sm:px-5 dark:hover:bg-zinc-900/40",
          FOCUS,
        )}
      >
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-medium text-zinc-900 dark:text-zinc-100">{board.name}</span>
          <span className="mt-0.5 block truncate font-mono text-[12px] text-zinc-500 dark:text-zinc-400">
            {meta.map((part, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span aria-hidden> · </span>}
                {i > 0 && <span className="sr-only">, </span>}
                {part}
              </React.Fragment>
            ))}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {day && (
            <span className="font-mono text-[12px] text-zinc-500 dark:text-zinc-400">
              <span className="sr-only">Updated </span>
              <time dateTime={board.updatedAt}>{day}</time>
            </span>
          )}
          <ArrowRight
            aria-hidden
            className="h-3.5 w-3.5 text-[#E6212F] transition-transform group-hover:translate-x-0.5"
          />
        </span>
      </Link>
    </li>
  );
}

/* The user's Query boards in every scope, newest first. A Playground
   dashboard that has not come over yet lists as its board: Query makes the
   board when its link opens. */
export function QuerySection() {
  const [load, setLoad] = React.useState<Load>({ status: "loading" });
  // each retry is a new read; a read the section left (unmount, a newer try) sets nothing
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/profile/query-boards", { cache: "no-store", signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<ProfileBoards>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => {
        if (ctrl.signal.aborted) return;
        setLoad({ status: "ready", boards: Array.isArray(data?.boards) ? data.boards : [] });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setLoad({ status: "error" });
      });
    return () => ctrl.abort();
  }, [attempt]);

  const retry = () => {
    setLoad({ status: "loading" });
    setAttempt((n) => n + 1);
  };

  return (
    <>
      <SectionHeader
        eyebrow="Activity"
        title="Query"
        id="section-title"
        action={<LinkButton href={QUERY_HREF}>Open Query</LinkButton>}
      />
      <Stack>
        <Group label="Boards">
          {load.status === "loading" && (
            <div role="status">
              <span className="sr-only">Loading your boards</span>
              <SkeletonRows rows={3} />
            </div>
          )}
          {load.status === "error" && <ErrorLine onRetry={retry}>Could not load your boards.</ErrorLine>}
          {load.status === "ready" &&
            (load.boards.length === 0 ? (
              <EmptyState action={<LinkButton href={QUERY_HREF}>Open Query</LinkButton>}>
                No boards yet. Pin a chart from Query to make one.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {load.boards.map((b) => (
                  <BoardRow key={`${b.scope}/${b.id}`} board={b} />
                ))}
              </ul>
            ))}
        </Group>
      </Stack>
    </>
  );
}
