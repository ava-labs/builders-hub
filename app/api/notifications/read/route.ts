import { getToken, encode } from "next-auth/jwt";
import { NextResponse } from "next/server";

export async function POST(req: any): Promise<Response> {
  try {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET ?? "",
    });
    if (!token) return new Response("Unauthorized", { status: 401 });
    const encodedToken = await encode({
      token: token,
      secret: process.env.NEXTAUTH_SECRET ?? "",
    });
    if (!encodedToken)
      return new Response("Error at get notifications", { status: 500 });

    const body: any = await req.json();

    const baseUrl: string | undefined = process.env.NEXT_PUBLIC_AVALANCHE_WORKERS_URL;
    const avalancheWorkersApiKey: string | undefined =
      process.env.AVALANCHE_WORKERS_API_KEY;

    if (!baseUrl || !avalancheWorkersApiKey) {
      return NextResponse.json({ error: "Failed" }, { status: 500 });
    }

    console.log('BODY: ', body)
    const upstream: Response = await fetch(`${baseUrl}/notifications/read`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": avalancheWorkersApiKey,
      },
      body: JSON.stringify({
        notifications: body,
        authUser: token.id,
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
