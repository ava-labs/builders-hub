"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { ConsoleHistoryItem, ConsoleHistoryPage } from "@/server/services/console-history";
import {
  Button,
  Cell,
  EmptyState,
  ErrorLine,
  FOCUS,
  Group,
  LinkButton,
  SectionHeader,
  SkeletonRows,
  Stack,
  StatusMark,
  Tag,
} from "../ui";
import { formatMoment } from "./format";

const PAGE_SIZE = 20;

async function fetchPage(cursor: string | null): Promise<ConsoleHistoryPage> {
  const qs = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (cursor) qs.set("cursor", cursor);
  const res = await fetch(`/api/profile/console-history?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const page = (await res.json()) as ConsoleHistoryPage;
  if (!Array.isArray(page?.items)) throw new Error("Bad response");
  return { items: page.items, nextCursor: typeof page.nextCursor === "string" ? page.nextCursor : null };
}

/** a long hash or address, cut in the middle */
const short = (s: string) => (s.length > 20 ? `${s.slice(0, 10)}…${s.slice(-8)}` : s);

const TONE = { success: "ok", error: "error", info: "idle" } as const;

export function ConsoleHistorySection() {
  const [items, setItems] = React.useState<ConsoleHistoryItem[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading");
  const [moreBusy, setMoreBusy] = React.useState(false);
  const [moreFailed, setMoreFailed] = React.useState(false);
  // the first row of the last loaded page: "Load more" is disabled while busy and drops focus
  const [focusId, setFocusId] = React.useState<string | null>(null);
  const alive = React.useRef(true);

  React.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const load = React.useCallback(() => {
    setState("loading");
    setMoreFailed(false);
    fetchPage(null)
      .then((page) => {
        if (!alive.current) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setState("ready");
      })
      .catch(() => alive.current && setState("error"));
  }, []);

  React.useEffect(load, [load]);

  const loadMore = () => {
    if (!nextCursor || moreBusy) return;
    setMoreBusy(true);
    setMoreFailed(false);
    fetchPage(nextCursor)
      .then((page) => {
        if (!alive.current) return;
        setItems((prev) => {
          const seen = new Set(prev.map((i) => i.id));
          return [...prev, ...page.items.filter((i) => !seen.has(i.id))];
        });
        setNextCursor(page.nextCursor);
        setFocusId(page.items[0]?.id ?? null);
      })
      .catch(() => alive.current && setMoreFailed(true))
      .finally(() => alive.current && setMoreBusy(false));
  };

  const openConsole = <LinkButton href="/console">Open Console</LinkButton>;

  return (
    <>
      <SectionHeader eyebrow="Activity" title="Console history" id="section-title" action={openConsole} />
      <Stack>
        <Group label="Activity">
          {state === "loading" ? (
            <>
              <p role="status" className="sr-only">
                Loading your Console history
              </p>
              <SkeletonRows rows={4} />
            </>
          ) : state === "error" ? (
            <ErrorLine onRetry={load}>Could not load your Console history.</ErrorLine>
          ) : items.length === 0 ? (
            <EmptyState action={openConsole}>No Console activity yet.</EmptyState>
          ) : (
            <>
              <ul aria-label="Console activity" className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {items.map((item) => (
                  <HistoryRow key={item.id} item={item} focus={item.id === focusId} />
                ))}
              </ul>
              {moreFailed ? (
                <ErrorLine onRetry={loadMore}>Could not load more activity.</ErrorLine>
              ) : (
                nextCursor && (
                  <Cell className="flex justify-center">
                    <Button variant="secondary" busy={moreBusy} onClick={loadMore}>
                      Load more
                    </Button>
                  </Cell>
                )
              )}
            </>
          )}
        </Group>
      </Stack>
    </>
  );
}

function HistoryRow({ item, focus }: { item: ConsoleHistoryItem; focus: boolean }) {
  const ref = React.useRef<HTMLLIElement>(null);
  React.useEffect(() => {
    if (focus) ref.current?.focus();
  }, [focus]);
  const data = item.address ?? item.hash;
  const when = formatMoment(item.createdAt);
  return (
    <li
      ref={ref}
      tabIndex={focus ? -1 : undefined}
      className={cn(
        "flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5",
        FOCUS,
      )}
    >
      <div className="flex min-w-0 gap-3">
        <span className="pt-1.5">
          <StatusMark tone={TONE[item.status]} />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-zinc-900 [overflow-wrap:anywhere] dark:text-zinc-100">
            {item.title}
          </p>
          {item.detail && (
            <p className="mt-0.5 text-[13px] text-zinc-500 [overflow-wrap:anywhere] dark:text-zinc-400">
              {item.detail}
            </p>
          )}
          {data && (
            <p className="mt-1 font-mono text-[12px] text-zinc-500 dark:text-zinc-400" title={data}>
              {item.address ? `Contract ${short(data)}` : short(data)}
            </p>
          )}
        </div>
      </div>
      {/* fixed columns from sm up, so the dates line up whether or not a row
          has a network tag or a link */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 pl-5 sm:grid sm:grid-cols-[4.5rem_11.5rem_4.5rem] sm:justify-items-end sm:pl-0">
        {item.network ? <Tag>{item.network === "testnet" ? "Fuji" : "Mainnet"}</Tag> : <span aria-hidden className="hidden sm:block" />}
        {when ? (
          <time
            dateTime={item.createdAt}
            className="font-mono text-[12px] tabular-nums text-zinc-500 dark:text-zinc-400"
          >
            {when}
          </time>
        ) : (
          <span aria-hidden className="hidden sm:block" />
        )}
        {item.href ? (
          <LinkButton href={item.href} variant="ghost" className="h-7 px-2">
            View<span className="sr-only">: {item.title}, in the Explorer</span>
          </LinkButton>
        ) : (
          <span aria-hidden className="hidden sm:block" />
        )}
      </div>
    </li>
  );
}
