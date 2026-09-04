import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { withAuthPermission } from "@/lib/protectedRoute";
import { hasPermission } from "@/lib/auth/rolePermissions";

function stripMdxExpressions(content: string): string {
  return content
    .replace(/^export\s[^\n]*/gm, "")
    .replace(/^import\s[^\n]*/gm, "")
    .replace(/\{[^}]*\}/g, "")
    .trim();
}

/**
 * The audience decides who receives the notification, so it is an
 * authorization input and must be validated before it is trusted. Unknown keys
 * are stripped by Zod's default object behaviour, so a caller cannot smuggle a
 * broader audience shape past the checks below.
 */
const audienceSchema = z.object({
  all: z.boolean().optional().default(false),
  hackathons: z.array(z.string().min(1)).optional().default([]),
  users: z.array(z.string().email()).optional().default([]),
});

const notificationSchema = z.object({
  audience: audienceSchema,
  type: z.string().min(1).optional(),
  title: z.string().min(1),
  short_description: z.string().optional(),
  content: z.string().optional(),
  content_type: z.string().optional(),
});

const createNotificationsSchema = z.object({
  notifications: z.array(notificationSchema).min(1),
});

export const POST = withAuthPermission(
  { resource: "notification", action: "write" },
  async (req: NextRequest, _ctx: unknown, session) => {
    try {
      const baseUrl: string | undefined =
        process.env.NEXT_PUBLIC_AVALANCHE_WORKERS_URL;

      const parsed = createNotificationsSchema.safeParse(
        await req.json().catch(() => null),
      );
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: "Invalid request body",
            details: parsed.error.issues.map((i) => ({
              field: i.path.join(".") || "(body)",
              message: i.message,
            })),
          },
          { status: 400 },
        );
      }
      const body = parsed.data;

      // notification:write allows sending to specific hackathons.
      // Anything broader — every user, or an arbitrary list of addresses — is
      // notification:manage (notify_all, devrel). Re-checked here because the
      // route guard above cannot see the payload.
      const canSendAnywhere = hasPermission(session.user.custom_attributes, {
        resource: "notification",
        action: "manage",
      });

      if (!canSendAnywhere) {
        const wantsAllUsers = body.notifications.some((n) => n.audience.all);
        if (wantsAllUsers) {
          return NextResponse.json(
            {
              error: "Forbidden",
              message: "Sending to all users requires the notification:manage permission",
            },
            { status: 403 },
          );
        }
        // An arbitrary address list is equivalent to a broadcast for anyone who
        // can enumerate emails, so it needs the same permission.
        const wantsArbitraryUsers = body.notifications.some(
          (n) => n.audience.users.length > 0,
        );
        if (wantsArbitraryUsers) {
          return NextResponse.json(
            {
              error: "Forbidden",
              message:
                "Sending to a list of addresses requires the notification:manage permission",
            },
            { status: 403 },
          );
        }
        // Hackathon-targeted sends stay open to notification:write — that is
        // what the role is for. "Specific hackathons" contrasts with "all
        // users", not with "events you own": notify_event carries no event
        // role, so scoping it by ownership would leave it unable to send at
        // all. Narrowing this further is a product decision, not a fix.
        const hasAudience = body.notifications.every(
          (n) => n.audience.hackathons.length > 0,
        );
        if (!hasAudience) {
          return NextResponse.json(
            { error: "Invalid request body", message: "No audience selected." },
            { status: 400 },
          );
        }
      }

      const notifications = body.notifications.map((n) => ({
        ...n,
        content:
          typeof n.content === "string" ? stripMdxExpressions(n.content) : n.content,
      }));

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
          notifications,
          authUser: session.user.id,
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
)