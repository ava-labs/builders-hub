import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/protectedRoute";

export const runtime: "nodejs" = "nodejs";

const baseUrl: string | undefined = process.env.NEXT_PUBLIC_AVALANCHE_WORKERS_URL;
const avalancheWokersApiKey: string | undefined =
  process.env.AVALANCHE_WORKERS_API_KEY;

export const POST = withAuth(async (_req: NextRequest, _ctx: unknown, session) => {
  try {
    if (!baseUrl || !avalancheWokersApiKey) {
      return NextResponse.json({ error: "Failed" }, { status: 500 });
    }

    const upstream: Response = await fetch(
      `${baseUrl}/notifications/get/inbox`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": avalancheWokersApiKey,
        },
        body: JSON.stringify({ authUser: session.user.id }),
        cache: "no-store",
      },
    );

    if (!upstream.ok) {
      // Gracefully handle upstream service unavailable
      if (upstream.status >= 500) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Notifications service unavailable - returning empty notifications');
        }
        return NextResponse.json({}, { status: 200 });
      }

      const text: string = await upstream.text();
      return NextResponse.json(
        { error: text || "Failed to fetch notifications" },
        { status: upstream.status },
      );
    }

    const payload: unknown = await upstream.json();
    return NextResponse.json(payload, { status: 200 });
  } catch (err: unknown) {
    // Gracefully handle network errors (workers not deployed)
    if (process.env.NODE_ENV === 'development') {
      console.warn('Notifications service error - returning empty notifications:', err instanceof Error ? err.message : 'Unknown error');
    }
    return NextResponse.json({}, { status: 200 });
  }
});
