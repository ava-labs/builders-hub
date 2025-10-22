import { NextRequest } from "next/server";
import { loadFonts, createOGResponse } from "@/utils/og-image";

export const runtime = "edge";

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl;
  const rawTitle = searchParams.get("title");
  const title = rawTitle?.replace(/\s*\|\s*Avalanche Builder Hub$/, "");
  const description = searchParams.get("description");

  const fonts = await loadFonts();

  return createOGResponse({
    title: title ?? "Stats",
    description:
      description ??
      "Real-time metrics and analytics for the Avalanche ecosystem",
    path: "stats",
    fonts,
  });
}
