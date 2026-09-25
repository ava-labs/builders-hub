import { sendMail } from "@/server/services/mail";
import { renderAuditEmail } from "@/server/services/audits/emails/template";
import { PORTAL_URL } from "@/server/services/audits/emails/links";

export interface TeamChangeNotice {
  quoteEmail: string;
  firmName: string;
  changedEmail: string;
  actorEmail: string;
  change: "added" | "removed";
}

/**
 * Sent to a firm's quote email whenever its team changes FROM THE PORTAL
 * (S-2). firm_name is admin-controlled and both addresses are validated
 * lowercase emails; the shared template escapes once. Admin-originated
 * changes send nothing (members.ts gates on actor.type).
 */
export async function sendTeamChangeNotice(notice: TeamChangeNotice): Promise<void> {
  const added = notice.change === "added";
  const subject = added
    ? `A teammate was added to ${notice.firmName} on the audit whitelist`
    : `A teammate was removed from ${notice.firmName} on the audit whitelist`;
  const title = added
    ? `${notice.changedEmail} was added to ${notice.firmName}.`
    : `${notice.changedEmail} was removed from ${notice.firmName}.`;
  const body = added
    ? `${notice.actorEmail} added this address from the firm details page. It can now sign in to the auditor portal, receives every notice your firm receives and reads everything your firm's portal shows. Not expected? Remove it from the firm details page or contact the program team.`
    : `${notice.actorEmail} removed this address from the firm details page. It can no longer sign in to the auditor portal. Not expected? Contact the program team.`;
  const firmUrl = `${PORTAL_URL}/firm`;

  const html = renderAuditEmail({
    eyebrow: "Whitelist team change",
    title,
    body,
    cta: { label: "Open firm details", href: firmUrl, variant: "neutral" },
    footerLines: [
      "Sent to the firm's quote email whenever a teammate is added or removed from the portal.",
    ],
  });
  const text = [title, body, `Open firm details: ${firmUrl}`].join("\n");
  await sendMail(notice.quoteEmail, html, subject, text);
}
