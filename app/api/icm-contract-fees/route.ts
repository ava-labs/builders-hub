import { NextResponse } from "next/server";
import { getICMContractFeesData } from "@/lib/icm-clickhouse";

const CACHE_CONTROL_HEADER = 'public, max-age=14400, s-maxage=14400, stale-while-revalidate=86400';

export async function GET(_request: Request) {
  try {
    const result = await getICMContractFeesData();
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': CACHE_CONTROL_HEADER,
        'X-Data-Source': 'fresh',
      }
    });
  } catch (error) {
    console.error("Error fetching ICM contract fees:", error);
    return NextResponse.json(
      { error: "Failed to fetch ICM contract fees data" },
      { status: 500 }
    );
  }
}
