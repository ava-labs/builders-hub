import { getServerSession } from "next-auth";
import { AuthOptions } from "@/lib/auth/authOptions";
import { NextResponse } from "next/server";

export async function POST(req: any): Promise<Response> {
  try {
    const session = await getServerSession(AuthOptions);
    if (!session) return new Response("Unauthorized", { status: 401 });

    const body: any = await req.json();

    const baseUrl: string | undefined = process.env.NEXT_PUBLIC_AVALANCHE_WORKERS_URL;
    const avalancheWorkersApiKey: string | undefined =
      process.env.AVALANCHE_WORKERS_API_KEY;

    if (!baseUrl || !avalancheWorkersApiKey) {
      return NextResponse.json({ error: "Failed" }, { status: 500 });
    }

    const upstream: Response = await fetch(`${baseUrl}/notifications/read`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": avalancheWorkersApiKey,
      },
      body: JSON.stringify({
        notifications: body,
        authUser: session.user.id,
      }),
      cache: "no-store",
    });

    if (!upstream.ok) {
      const text: string = await upstream.text();
      return NextResponse.json(
        { error: text || "Failed to read notifications" },
        { status: upstream.status },
      );
    }

    const contentType: string | null = upstream.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const payload: unknown = await upstream.json();
      return NextResponse.json(payload, { status: 200 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: unknown) {
    const message: string =
      err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
