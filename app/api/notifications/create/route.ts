import { getToken, encode } from "next-auth/jwt";
import { NextResponse } from "next/server";

function stripMdxExpressions(content: string): string {
  return content
    .replace(/^export\s[^\n]*/gm, "")
    .replace(/^import\s[^\n]*/gm, "")
    .replace(/\{[^}]*\}/g, "")
    .trim();
}

export async function POST(req: any): Promise<Response> {
  try {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET ?? "",
    });
    const sessionCustomAttributes = token?.custom_attributes || [""];
    if (
      !(
        sessionCustomAttributes.includes("devrel") ||
        sessionCustomAttributes.includes("moderator")
      )
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!token) return new Response("Unauthorized", { status: 401 });
    const encodedToken = await encode({
      token: token,
      secret: process.env.NEXTAUTH_SECRET ?? "",
    });
    if (!encodedToken)
      return new Response("Error at get notifications", { status: 500 });

    const baseUrl: string | undefined =
      process.env.NEXT_PUBLIC_AVALANCHE_WORKERS_URL;

    const body: any = await req.json();

    if (Array.isArray(body.notifications)) {
      body.notifications = body.notifications.map((n: any) => ({
        ...n,
        content:
          typeof n.content === "string"
            ? stripMdxExpressions(n.content)
            : n.content,
      }));
    }

    const avalancheWorkersApiKey: string | undefined =
      process.env.AVALANCHE_WORKERS_API_KEY;

    if (!baseUrl || !avalancheWorkersApiKey) {
      return NextResponse.json({ error: "Failed" }, { status: 500 });
    }

    const upstream: Response = await fetch(`${baseUrl}/notifications/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": avalancheWorkersApiKey,
      },
      body: JSON.stringify({
        notifications: body.notifications,
        authUser: token.id,
      }),
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
