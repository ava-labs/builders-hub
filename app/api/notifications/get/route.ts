import { getToken, encode } from "next-auth/jwt";
import { NextResponse } from "next/server";

type GetNotificationsBody = {
  users: string[];
};
export const runtime: "nodejs" = "nodejs";

const baseUrl: string | undefined = process.env.AVALANCHE_METRICS_URL;

export async function POST(req: any): Promise<Response> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET ?? '' })
  if (!token) return new Response("Unauthorized", { status: 401 });
  const encodedToken = await encode({token: token, secret: process.env.NEXTAUTH_SECRET ?? ''})
  if (!encodedToken) return new Response("Error at get notifications", { status: 500});

  try {
    if (!baseUrl) {
      return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
    const upstream: Response = await fetch(
      `${baseUrl}/notifications/get/inbox`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "authorization": encodedToken
        },
        cache: "no-store",
      }
    );

    if (!upstream.ok) {
      const text: string = await upstream.text();
      return NextResponse.json(
        { error: text || "Failed to fetch notifications" },
        { status: upstream.status }
      );
    }

    const payload: unknown = await upstream.json();
    return NextResponse.json(payload, { status: 200 });
  } catch (err: unknown) {
    const message: string =
      err instanceof Error ? err.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}