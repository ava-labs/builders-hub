import { z } from "zod";

/**
 * The one email rule, shared by client-side checks and server-side Zod schemas.
 *
 * It must be a single definition, not two that merely look alike: the invite
 * endpoint used to validate with `z.string().email()` while its callers gated on
 * a looser hand-rolled regex. They disagreed on addresses like
 * `josé@example.com`, and because Zod validates an array atomically, one such
 * address rejected an entire batch of invitations.
 *
 * Import `emailSchema` in Zod schemas; call `isValidEmail` from UI code.
 */
export const emailSchema = z.string().email();

export function isValidEmail(email: string): boolean {
  return emailSchema.safeParse(email).success;
}
