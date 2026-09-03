import { sendMail } from "@/server/services/mail";

/**
 * A firm as an email audience: the quote email plus every approved teammate.
 * Federico, 2026-09-02: everyone on the approved list receives every notice,
 * there is no main and secondary address. Rows loaded without `members`
 * degrade to the quote email alone, so older call sites keep working.
 */
export interface FirmRecipient {
  firm_name: string;
  quote_email: string;
  members?: { email: string }[];
}

/** Lowercased, de-duplicated recipient list for one firm. */
export function recipientsOf(firm: Pick<FirmRecipient, "quote_email" | "members">): string[] {
  const all = [firm.quote_email, ...(firm.members ?? []).map((member) => member.email)]
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
  return Array.from(new Set(all));
}

/**
 * The address a project may contact once it accepts a quote: the teammate who
 * saved it, as long as that address is still approved for the firm. A removed
 * teammate's address stays on the quote row as history but is never handed to
 * the project; the firm's quote email takes over. Quotes saved before team
 * access carry no submitter and resolve to the quote email too.
 */
export function firmContact(
  firm: Pick<FirmRecipient, "quote_email" | "members">,
  submittedBy: string | null | undefined,
): string {
  const normalized = submittedBy?.trim().toLowerCase();
  return normalized && recipientsOf(firm).includes(normalized) ? normalized : firm.quote_email;
}

/**
 * One notice, every approved address, sent in parallel. The firm counts as
 * reached when at least one address accepted the mail: only a total failure
 * rejects, so one bad teammate address never marks the firm's fan-out
 * delivery as failed. Partial failures go to the server log.
 */
export async function sendToFirm(
  recipients: string[],
  html: string,
  subject: string,
  text: string,
): Promise<void> {
  if (recipients.length === 0) throw new Error("No recipients for firm notice");
  const sends = await Promise.allSettled(recipients.map((to) => sendMail(to, html, subject, text)));
  const failed = sends.filter((send): send is PromiseRejectedResult => send.status === "rejected");
  if (failed.length === sends.length) throw failed[0].reason;
  failed.forEach((send) =>
    console.error("[Audits] firm notice failed for one address:", send.reason),
  );
}
