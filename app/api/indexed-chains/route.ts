import { NextResponse } from "next/server";
import { fetchIndexedChainIds } from "@/lib/stats-coverage";

// The chain IDs our stats API actually indexes.

export const revalidate = 900;

export async function GET() {
  const ids = await fetchIndexedChainIds();
  return NextResponse.json(
    { indexed: ids ? [...ids] : null },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=3600",
      },
    },
  );
}
