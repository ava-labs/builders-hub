import { NextRequest } from "next/server";
import { loadFonts, createOGResponse } from "@/utils/og-image";

export const runtime = "edge";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<Response> {
  const { searchParams } = request.nextUrl;
  const { slug } = await params;
  const rawTitle = searchParams.get("title");
  const title = rawTitle?.replace(/\s*\|\s*Avalanche Builder Hub$/, "");
  const description = searchParams.get("description");

  const fonts = await loadFonts();

  return createOGResponse({
    title: title ?? `${slug} Stats`,
    description: description ?? `Real-time metrics and analytics for ${slug}`,
    path: `stats/l1/${slug}`,
    fonts,
  });
}
