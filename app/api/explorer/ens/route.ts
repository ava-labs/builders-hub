import { NextResponse } from "next/server";
import { lookupEnsName, resolveEnsName } from "@/lib/ens";

/* GET ?name=vitalik.eth -> { name, address }
   GET ?address=0x...    -> { address, name }
   A missing record is a 200 with a null field; an RPC failure is a 502. */

const HEADERS = { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" };

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const name = params.get("name");
  const address = params.get("address");
  try {
    if (name) return NextResponse.json({ name, address: await resolveEnsName(name) }, { headers: HEADERS });
    if (address) return NextResponse.json({ address, name: await lookupEnsName(address) }, { headers: HEADERS });
    return NextResponse.json({ error: "Pass name or address" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "ENS lookup failed" }, { status: 502 });
  }
}
