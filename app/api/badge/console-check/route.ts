import { NextResponse } from "next/server";

// The Console no longer gives badges. Browser tabs opened before the removal
// can still call this route once, so it answers 410 Gone instead of 404.
export function POST() {
  return NextResponse.json({ error: "Console badges have been removed." }, { status: 410 });
}
