"use client";

/* The SQL editor's schema browser: the tables this chain's Query may
   read, each with its typed columns (app/api/explorer/query/schema). A
   click on a table's or a column's name writes it into the query at the
   caret. It stands beside the editor from lg, and folds above it on a
   phone. */

import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SchemaTable {
  name: string;
  columns: { name: string; type: string }[];
}

/** each chain's tables, read once a visit: every editor on the page shares the read */
const schemas = new Map<string, Promise<SchemaTable[]>>();

function readSchema(chainId: string): Promise<SchemaTable[]> {
  const kept = schemas.get(chainId);
  if (kept) return kept;
  const read = fetch(`/api/explorer/query/schema?chainId=${encodeURIComponent(chainId)}`).then(async (res) => {
    const out = (await res.json()) as { tables?: SchemaTable[] };
    if (!res.ok || !out.tables?.length) throw new Error(`HTTP ${res.status}`);
    return out.tables;
  });
  schemas.set(chainId, read);
  // a read that failed is made again by the next editor to open
  read.catch(() => schemas.delete(chainId));
  return read;
}

/** a chain's tables: "loading" until the read ends, null when it failed */
export function useSchema(chainId: string | number): SchemaTable[] | "loading" | null {
  const key = String(chainId);
  const [got, setGot] = useState<{ key: string; tables: SchemaTable[] | null } | null>(null);
  useEffect(() => {
    let live = true;
    readSchema(key).then(
      (tables) => live && setGot({ key, tables }),
      () => live && setGot({ key, tables: null }),
    );
    return () => {
      live = false;
    };
  }, [key]);
  return got?.key === key ? got.tables : "loading";
}

const LABEL = "font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400";
const FRAME = "rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950";
const QUIET = "font-mono text-[11px] text-zinc-500 dark:text-zinc-400";

type Props = { tables: SchemaTable[] | "loading"; onPick: (name: string) => void };

/** the filter box and the tables under it; a table's columns show when its arrow opens them, or while the filter finds one of them */
function SchemaList({ tables, onPick }: { tables: SchemaTable[]; onPick: (name: string) => void }) {
  const [filter, setFilter] = useState("");
  // the tables opened by hand; and, while the filter finds columns in a table and so opens it, the ones shut by hand
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const [shut, setShut] = useState<ReadonlySet<string>>(new Set());
  const q = filter.trim().toLowerCase();
  const shown = tables.flatMap((t) => {
    const hits = q ? t.columns.filter((c) => c.name.toLowerCase().includes(q)) : [];
    if (q && hits.length === 0 && !t.name.toLowerCase().includes(q)) return [];
    return [{ name: t.name, count: t.columns.length, found: hits.length > 0, columns: hits.length ? hits : t.columns, open: hits.length ? !shut.has(t.name) : opened.has(t.name) }];
  });
  const turn = (name: string, found: boolean) =>
    (found ? setShut : setOpened)((prev) => {
      const next = new Set(prev);
      if (!next.delete(name)) next.add(name);
      return next;
    });
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <input
        type="search"
        value={filter}
        onChange={(e) => {
          setFilter(e.target.value);
          setShut(new Set());
        }}
        placeholder="Filter tables and columns"
        aria-label="Filter schema"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className="mx-3 mb-2 rounded-lg border border-zinc-200 bg-transparent px-2 py-1 font-mono text-[16px] text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-900 md:text-[11px] dark:border-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-600 dark:focus:border-zinc-100"
      />
      <ul className="max-h-72 min-h-0 flex-1 overflow-y-auto pb-2 lg:max-h-none">
        {shown.map((t) => (
          <li key={t.name}>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => turn(t.name, t.found)}
                aria-expanded={t.open}
                aria-label={`Columns of ${t.name}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center text-zinc-400 transition-colors hover:text-zinc-900 lg:h-6 dark:text-zinc-500 dark:hover:text-zinc-50"
              >
                <ChevronRight className={cn("h-3 w-3 transition-transform duration-200 motion-reduce:transition-none", t.open && "rotate-90")} />
              </button>
              <button
                type="button"
                onClick={() => onPick(t.name)}
                title={`Insert ${t.name}`}
                className="min-w-0 flex-1 truncate py-1 text-left font-mono text-[12px] text-zinc-900 transition-colors hover:text-[#E6212F] dark:text-zinc-50"
              >
                {t.name}
              </button>
              <span className="shrink-0 pl-2 pr-3 font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">{t.count}</span>
            </div>
            {t.open && (
              <ul>
                {t.columns.map((c) => (
                  <li key={c.name}>
                    <button
                      type="button"
                      onClick={() => onPick(c.name)}
                      title={`Insert ${c.name} (${c.type})`}
                      className="group flex w-full items-baseline gap-2 py-1 pl-8 pr-3 text-left font-mono text-[11px] lg:py-0.5"
                    >
                      <span className="shrink-0 text-zinc-700 transition-colors group-hover:text-[#E6212F] dark:text-zinc-300">{c.name}</span>
                      <span className="min-w-0 truncate text-zinc-400 dark:text-zinc-500">{c.type}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
        {shown.length === 0 && <li className={cn(QUIET, "px-3 py-1")}>No table or column matches.</li>}
      </ul>
    </div>
  );
}

/** the schema on a phone: folded above the editor */
export function SchemaFold({ tables, onPick }: Props) {
  if (tables === "loading") return <p className={cn(QUIET, "lg:hidden")}>Loading schema</p>;
  return (
    <details className={cn(FRAME, "group lg:hidden")}>
      <summary className={cn(LABEL, "flex cursor-pointer select-none list-none items-center gap-1.5 px-3 py-2.5 [&::-webkit-details-marker]:hidden")}>
        <ChevronRight className="h-3 w-3 transition-transform duration-200 group-open:rotate-90 motion-reduce:transition-none" />
        Schema
        <span className="font-normal normal-case tracking-normal">{tables.length} tables</span>
      </summary>
      <SchemaList tables={tables} onPick={onPick} />
    </details>
  );
}

/** the schema from lg: a panel on the editor's right */
export function SchemaSide({ tables, onPick }: Props) {
  return (
    <aside aria-label="Schema" className={cn(FRAME, "hidden max-h-[26rem] w-64 shrink-0 flex-col lg:flex")}>
      <span className={cn(LABEL, "px-3 pb-2 pt-3")}>Schema</span>
      {tables === "loading" ? <p className={cn(QUIET, "px-3 pb-3")}>Loading schema</p> : <SchemaList tables={tables} onPick={onPick} />}
    </aside>
  );
}
