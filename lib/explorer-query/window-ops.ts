/* The window buttons and the period before, on the server: the answer's SQL is read in its shorthand form
   (collapseMacros), its one window is written again (window-shift.ts), and what comes out passes the guard like any
   SQL a reader sends. No model is asked. Fuji keeps the page it had. */

import { guardSql } from "./guard";
import { collapseMacros } from "./macros";
import { sqlWindow, windowWords, withWindow, windowSpan } from "./scope";
import { isFuji } from "./target";
import { bucketWords, movableWindow, movesOf, priorSql, withSpan, type Moves, type SpanKey } from "./window-shift";

type Refused = { ok: false; error: string };

const FIXED = "This answer reads a window the page cannot move.";

/** what the page may do with this answer's window, or null when the window is not one it can move */
export function answerMoves(sql: string, x: string | undefined, chainId: number, now: number): Moves | null {
  if (!sql || isFuji(chainId)) return null;
  const m = movableWindow(collapseMacros(sql, chainId), x, now);
  return m ? movesOf(m) : null;
}

/** the answer's query and its drill over another span, guarded */
export function movedSql(sql: string, drill: string | null | undefined, x: string | undefined, key: SpanKey, chainId: number, now: number): { ok: true; sql: string; drill: string | null } | Refused {
  if (isFuji(chainId)) return { ok: false, error: FIXED };
  const read = collapseMacros(sql, chainId);
  const m = movableWindow(read, x, now);
  if (!m) return { ok: false, error: FIXED };
  const g = guardSql(withSpan(read, key, m), chainId);
  if (!g.ok) return g;
  return { ok: true, sql: g.sql, drill: drill ? withSpan(drill, key, m) : null };
}

/** the answer's query over the period before its window, guarded */
export function priorOf(sql: string, x: string | undefined, chainId: number, now: number): { ok: true; sql: string } | Refused {
  if (isFuji(chainId)) return { ok: false, error: FIXED };
  const read = collapseMacros(sql, chainId);
  const m = movableWindow(read, x, now);
  const before = m ? priorSql(read, m) : null;
  if (!before) return { ok: false, error: FIXED };
  const g = guardSql(before, chainId);
  return g.ok ? { ok: true, sql: g.sql } : g;
}

const bare = (words: string) => words.replace(/^in the /, "");

/** an answer's title and note after its window moved: the old window's words give way to the new one's, the
    periods are named for the span's bucket, and what still names another window is left out (scope.ts) */
export function movedWords(said: { title: string; note: string }, from: string, to: string, x: string | undefined, key: SpanKey, rows: readonly Record<string, unknown>[], chainId: number, now: number, clock: number): { title: string; note: string; span: string | null } {
  const [was, is] = [sqlWindow(collapseMacros(from, chainId), now), collapseMacros(to, chainId)];
  const next = sqlWindow(is, now);
  const swap = (text: string) => {
    const named = bucketWords(text, key);
    if (!was || was === "unknown" || !next || next === "unknown") return named;
    // the whole phrase first (today, in the last 6 hours), then the span alone (last 6 hours)
    const [old, fresh] = [windowWords(was, now), windowWords(next, now)];
    const each = (text: string, a: string, b: string) => text.replace(new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), b);
    return each(each(named, old, fresh), bare(old), bare(fresh));
  };
  return { ...withWindow({ title: swap(said.title), note: swap(said.note) }, is, rows, x, now, clock), span: windowSpan(is, rows, x, now, clock) };
}
