/* an answer after a window button: the rows of the new span under the layout the answer had, with the layout's
   words named for the span's bucket. The reading and the marks were about the first window, so they go. */

import type { QueryResult } from "@/lib/explorer-query/clickhouse";
import type { Names, QueryAnswer, SourceNote, Totals } from "@/lib/explorer-query/types";
import { bucketWords, type Moves, type SpanKey } from "@/lib/explorer-query/window-shift";

/** what the route hands back for a window button (POST { move }) */
export interface Moved {
  title: string;
  note: string;
  span: string | null;
  sql: string;
  drill: string | null;
  result: QueryResult;
  names: Names;
  totals: Totals | null;
  anchor: string | null;
  sources?: SourceNote[];
  moves: Moves | null;
}

export function movedAnswer(from: QueryAnswer, out: Moved, key: SpanKey): QueryAnswer {
  const words = (text: string) => bucketWords(text, key);
  const v = from.visual;
  return {
    ...from,
    title: out.title,
    note: out.note,
    span: out.span,
    sql: out.sql,
    drill: from.drill && out.drill ? { ...from.drill, sql: out.drill, title: words(from.drill.title) } : null,
    result: out.result,
    totals: out.totals,
    names: out.names ?? {},
    anchor: out.anchor,
    sources: out.sources ?? [],
    moves: out.moves,
    visual: v && {
      ...v,
      callouts: [],
      stats: v.stats.map((s) => ({ ...s, label: words(s.label), sub: s.sub ? words(s.sub) : s.sub })),
      panels: v.panels.map((p) => ({ ...p, title: words(p.title), series: p.series.map((s) => ({ ...s, label: words(s.label) })), markers: [], bands: [] })),
    },
    draftVisual: false,
    // the kept recipe is the first window's: nothing is laid out or read again from it
    key: undefined,
  };
}
