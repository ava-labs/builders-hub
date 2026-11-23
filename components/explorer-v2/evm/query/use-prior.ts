"use client";

/* the period before an answer's window, read once the answer stands: the same query, moved back by its own length */

import { useEffect, useState } from "react";
import type { QueryResult } from "@/lib/explorer-query/clickhouse";
import type { QueryAnswer, Totals } from "@/lib/explorer-query/types";
import { postQuery } from "../query-client";
import type { Prior } from "./stat-figures";

/** the rows of the period before the answer in view, or null until they land; null for good when the answer's window
    has no period before it, or the read fails: the figures then stand without their change */
export function usePrior(answer: QueryAnswer | null, chainId: string | number): Prior | null {
  const [got, setGot] = useState<{ sql: string; prior: Prior } | null>(null);
  const sql = answer?.result?.rowCount && answer.moves?.prior ? answer.sql : null;
  const x = answer?.chart.x;
  useEffect(() => {
    if (!sql) return;
    let live = true;
    postQuery<{ result: QueryResult; totals: Totals | null }>({ chainId, prior: { sql, x } }).then(
      (out) => live && setGot({ sql, prior: { rows: out.result.rows, totals: out.totals } }),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [sql, x, chainId]);
  return got && got.sql === sql ? got.prior : null;
}
