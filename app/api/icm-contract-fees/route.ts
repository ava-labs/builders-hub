import { NextResponse } from "next/server";
import { getICMContractFeesData } from "@/lib/icm-clickhouse";

export async function GET(_request: Request) {
  try {
    const result = await getICMContractFeesData();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching ICM contract fees:", error);
    return NextResponse.json(
      { error: "Failed to fetch ICM contract fees data" },
      { status: 500 }
    );
  }
}
