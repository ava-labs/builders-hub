"use client";

/* Boards follow a signed-in reader to every device. The device's store
   (board.ts) stays the source the page draws from; this module keeps it
   in step with the account. When a page for a scope mounts, it reads the
   account's boards once and merges them (the newer edit wins). After
   that, every change to the store is sent up a second later. A write the
   account refuses as older returns its copy, which the merge takes. */

import { useEffect, useSyncExternalStore } from "react";
import { useSession } from "next-auth/react";
import { goneBoards, listBoards, mergeRemote, reidBoard, type Board, type MergeOut, type RemoteBoard } from "./board";

export type SyncState = "off" | "loading" | "synced" | "error";

const EVENT = "explorer-query-boards";
const API = "/api/explorer/boards";
const PUSH_DELAY_MS = 1000;
/** read the account again when the tab comes back, at most this often */
const PULL_EVERY_MS = 30_000;

interface ScopeSync {
  state: SyncState;
  /** the edit time the account holds, per board id */
  sent: Map<string, number>;
  timer: ReturnType<typeof setTimeout> | null;
  pulledAt: number;
  users: number;
  stop: () => void;
}

const syncs = new Map<string, ScopeSync>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

function setState(s: ScopeSync, state: SyncState) {
  if (s.state === state) return;
  s.state = state;
  emit();
}

async function send(scope: string, s: ScopeSync, work: MergeOut): Promise<void> {
  const refused: RemoteBoard[] = [];
  for (const b of work.put) {
    const res = await fetch(`${API}/${encodeURIComponent(b.id)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scope, name: b.name, tiles: b.tiles.map(bare), createdAt: b.createdAt, updatedAt: b.updatedAt }),
    });
    if (res.ok) s.sent.set(b.id, b.updatedAt);
    else if (res.status === 409) {
      const body = (await res.json().catch(() => null)) as { board?: RemoteBoard; taken?: boolean } | null;
      if (body?.board) refused.push(body.board);
      // another account holds the id: the board takes a new one, and the store change sends it
      else if (body?.taken && reidBoard(scope, b.id)) continue;
      else throw new Error("board id taken");
    } else throw new Error(`PUT ${res.status}`);
  }
  for (const d of work.del) {
    const res = await fetch(`${API}/${encodeURIComponent(d.id)}?at=${d.at}`, { method: "DELETE" });
    if (res.ok) s.sent.set(d.id, d.at);
    else if (res.status === 409) {
      const body = (await res.json().catch(() => null)) as { board?: RemoteBoard } | null;
      if (body?.board) refused.push(body.board);
    } else throw new Error(`DELETE ${res.status}`);
  }
  if (refused.length) {
    for (const r of refused) s.sent.set(r.id, r.updatedAt);
    const again = mergeRemote(scope, refused, false);
    if (again.put.length || again.del.length) await send(scope, s, again);
  }
}

/** a tile without its rows: the account keeps layouts, not results */
function bare(t: Board["tiles"][number]) {
  if (t.kind !== "chart") return t;
  const { snapshot: _rows, ...rest } = t;
  void _rows;
  return rest;
}

async function pull(scope: string, s: ScopeSync): Promise<void> {
  s.pulledAt = Date.now();
  try {
    const res = await fetch(`${API}?scope=${encodeURIComponent(scope)}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`GET ${res.status}`);
    const { boards } = (await res.json()) as { boards: RemoteBoard[] };
    for (const r of boards) s.sent.set(r.id, Math.max(r.updatedAt, r.deletedAt ?? 0));
    const work = mergeRemote(scope, boards, true);
    await send(scope, s, work);
    setState(s, "synced");
  } catch (e) {
    console.warn("board sync:", e);
    setState(s, "error");
  }
}

/** the store changed: send what the account does not have yet */
function schedule(scope: string, s: ScopeSync) {
  if (s.timer) clearTimeout(s.timer);
  s.timer = setTimeout(() => {
    s.timer = null;
    // mid-read: the merge may already have run, so look again after it
    if (s.state === "loading") return schedule(scope, s);
    const put = listBoards(scope).filter((b) => (s.sent.get(b.id) ?? 0) < b.updatedAt);
    const del = Object.entries(goneBoards(scope))
      .filter(([id, at]) => s.sent.has(id) && (s.sent.get(id) ?? 0) < at)
      .map(([id, at]) => ({ id, at }));
    if (!put.length && !del.length) return;
    send(scope, s, { put, del })
      .then(() => setState(s, "synced"))
      .catch((e) => {
        console.warn("board sync:", e);
        setState(s, "error");
      });
  }, PUSH_DELAY_MS);
}

function start(scope: string): ScopeSync {
  const s: ScopeSync = { state: "loading", sent: new Map(), timer: null, pulledAt: 0, users: 0, stop: () => {} };
  const onChange = () => schedule(scope, s);
  const onFocus = () => {
    if (document.visibilityState === "visible" && Date.now() - s.pulledAt > PULL_EVERY_MS) void pull(scope, s);
  };
  window.addEventListener(EVENT, onChange);
  document.addEventListener("visibilitychange", onFocus);
  s.stop = () => {
    window.removeEventListener(EVENT, onChange);
    document.removeEventListener("visibilitychange", onFocus);
    if (s.timer) clearTimeout(s.timer);
  };
  syncs.set(scope, s);
  emit();
  void pull(scope, s);
  return s;
}

/** keep a scope's boards in step with the account while a page shows them */
export function useBoardSync(scope: string): SyncState {
  const { status } = useSession();
  const on = status === "authenticated";
  useEffect(() => {
    if (!on) return;
    const s = syncs.get(scope) ?? start(scope);
    s.users++;
    return () => {
      s.users--;
      // a page that swaps for another on the same scope keeps the sync
      setTimeout(() => {
        if (s.users > 0 || syncs.get(scope) !== s) return;
        s.stop();
        syncs.delete(scope);
        emit();
      }, 5000);
    };
  }, [on, scope]);
  const state = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => syncs.get(scope)?.state ?? "off",
    () => "off" as SyncState,
  );
  if (status === "loading") return "loading";
  return on ? (state === "off" ? "loading" : state) : "off";
}
