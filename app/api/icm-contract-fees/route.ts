import { NextResponse } from "next/server";
import { getICMContractFeesData } from "@/lib/icm-clickhouse";

const CACHE_CONTROL_HEADER = 'public, max-age=14400, s-maxage=14400, stale-while-revalidate=86400';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get("timeRange") || "all";
    const result = await getICMContractFeesData(timeRange);

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': CACHE_CONTROL_HEADER,
        'X-Data-Source': result.dataSource,
        'X-Cache-Timestamp': result.lastUpdated,
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
