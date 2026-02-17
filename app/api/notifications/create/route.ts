
import { getToken, encode } from "next-auth/jwt";
import { NextResponse } from "next/server";

type ReadNotificationsBody = unknown; // Keep it flexible unless you want to type it strictly.

export async function POST(req: any): Promise<Response> {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET ?? '' })
    if (!token) return new Response("Unauthorized", { status: 401 });
    const encodedToken = await encode({ token: token, secret: process.env.NEXTAUTH_SECRET ?? '' })
    if (!encodedToken) return new Response("Error at get notifications", { status: 500 });

    const body: ReadNotificationsBody = await req.json();

    const baseUrl: string | undefined = process.env.AVALANCHE_METRICS_URL;

    if (!baseUrl) {
      return NextResponse.json(
        { error: "Missing AVALANCHE_METRICS_URL" },
        { status: 500 }
      );
    }

    const upstream: Response = await fetch(`${baseUrl}/notifications/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "authorization": encodedToken,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!upstream.ok) {
      const text: string = await upstream.text();
      return NextResponse.json(
        { error: text || "Failed to read notifications" },
        { status: upstream.status }
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