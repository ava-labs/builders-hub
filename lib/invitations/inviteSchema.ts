import { z } from "zod";
import { emailSchema } from "@/lib/email";

// One SendGrid mail goes out per address, so cap the batch size. The request rate
// is capped separately in the route.
export const MAX_EMAILS_PER_REQUEST = 20;

/**
 * Body of POST /api/project/invite-member.
 *
 * `project_id` and `hackathon_id` are validated as non-empty strings, NOT as
 * UUIDs. Both columns are plain `String @id @default(uuid())`: the default is a
 * uuid, but nothing enforces it. These ids are authorized by lookup (confirmed
 * membership / hackathon existence), so their shape is not load-bearing, and a
 * `.uuid()` check buys no safety while rejecting any row seeded by hand or
 * restored from another environment — which is what broke local invites.
 *
 * Other endpoints do validate ids as UUIDs; that is deliberately left alone.
 * They work against production data, and tightening or loosening them is a
 * separate decision from what this endpoint needs.
 *
 * `project_id` is optional: Members.tsx invites with an empty id on a brand-new
 * submission and relies on the server to create the project first.
 */
export const inviteSchema = z.object({
  project_id: z.string().optional(),
  hackathon_id: z.string().min(1),
  // Same rule the callers gate on (lib/email.ts), so a client-accepted address can
  // never be rejected here — Zod validates the array atomically, so one bad entry
  // would otherwise reject the whole batch.
  emails: z.array(emailSchema).min(1).max(MAX_EMAILS_PER_REQUEST),
  user_id: z.string().optional().nullable(),
  stage: z.number().int().optional(),
  lang: z.string().optional(),
});

export type InviteBody = z.infer<typeof inviteSchema>;

/** Human-readable reason a body was rejected, for the caller to display. */
export function inviteErrorMessage(rawBody: unknown, error: z.ZodError): string {
  const emails: unknown[] =
    rawBody && typeof rawBody === "object" && Array.isArray((rawBody as { emails?: unknown }).emails)
      ? ((rawBody as { emails: unknown[] }).emails)
      : [];

  const badEmails = error.issues
    .filter((i) => i.path[0] === "emails" && typeof i.path[1] === "number")
    .map((i) => emails[i.path[1] as number])
    .filter((e): e is string => typeof e === "string");
  if (badEmails.length) return `These addresses are not valid: ${badEmails.join(", ")}`;

  if (error.issues.some((i) => i.path[0] === "emails" && i.code === "too_big")) {
    return `Invitations are limited to ${MAX_EMAILS_PER_REQUEST} addresses at a time.`;
  }
  return "Invalid invitation request.";
}
