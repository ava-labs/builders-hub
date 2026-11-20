import { NextResponse } from "next/server";
import l1ChainsData from "@/constants/l1-chains.json";
import { schemaTables, type TableSchema } from "@/lib/explorer-query/clickhouse";
import { refLine } from "@/lib/explorer-query/sources";
import { NETWORK_ID, NETWORK_SLUG, targetOf } from "@/lib/explorer-query/target";

/* The tables a chain's Query may read, for the SQL editor's schema
   browser. GET ?chainId= answers each table with its typed columns: the
   chain tables as the database describes them (the schema card the model
   reads is made from the same list), then the reference tables our server
   builds (sources.ts). These are the tables the guard allows (targetOf).
   chainId is what the query route takes: a chain id, 1 or 5 for the
   P-Chain, or the network's slug. */

export const dynamic = "force-dynamic";

const CACHE_CONTROL = "public, s-maxage=3600";

/** a reference table's line, "name(column Type, column Type)", as its columns; a type's own commas sit inside its parentheses */
function columnsOf(line: string): TableSchema["columns"] {
  const inner = line.slice(line.indexOf("(") + 1, -1);
  const cuts = [-1];
  for (let i = 0, depth = 0; i < inner.length; i++) {
    if (inner[i] === "(") depth++;
    else if (inner[i] === ")") depth--;
    else if (inner[i] === "," && depth === 0) cuts.push(i);
  }
  return cuts.map((at, j) => {
    const column = inner.slice(at + 1, cuts[j + 1] ?? inner.length).trim();
    const space = column.indexOf(" ");
    return { name: column.slice(0, space), type: column.slice(space + 1) };
  });
}

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("chainId") ?? "";
  const chainId = raw === NETWORK_SLUG ? NETWORK_ID : Number(raw);
  const known =
    raw === NETWORK_SLUG || (/^\d+$/.test(raw) && (targetOf(chainId).kind === "pchain" || (l1ChainsData as { chainId: string }[]).some((c) => c.chainId === raw)));
  if (!known) return NextResponse.json({ error: "unknown chain" }, { status: 400 });
  try {
    const refs = targetOf(chainId).refs.map((name) => ({ name, columns: columnsOf(refLine(name)) }));
    const tables: TableSchema[] = [...(await schemaTables(chainId)), ...refs];
    return NextResponse.json({ tables }, { headers: { "Cache-Control": CACHE_CONTROL } });
  } catch (e) {
    console.error("[GET /api/explorer/query/schema]", e instanceof Error ? e.message.slice(0, 200) : e);
    return NextResponse.json({ error: "The schema did not load." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
