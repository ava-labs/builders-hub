import { sendMail } from "@/server/services/mail";
import { renderAuditEmail } from "@/server/services/audits/emails/template";
import { PORTAL_URL } from "@/server/services/audits/emails/links";

export interface InviteRecipient {
  firm_name: string;
  /** The exact address being invited: the firm's quote email or a teammate. */
  email: string;
}

/**
 * Sent when an admin adds a firm to the whitelist (and on resend), and when an
 * admin approves a teammate address for a firm. The 6-digit OTP itself comes
 * from the existing sign-in flow; this only carries the instruction and the
 * portal link. Recipient is ALWAYS an Auditor or AuditorMember row's address.
 * Escaping lives in the shared template.
 */
export async function sendAuditorInvite(auditor: InviteRecipient): Promise<void> {
  const subject = "You've been added to the Avalanche audit marketplace";
  const text = [
    `${auditor.firm_name} is now on the Ava Labs audit whitelist.`,
    `Sign in with this email address to receive and quote audit requests: ${PORTAL_URL}`,
    "Your quotes are private to the requesting project and the program team.",
  ].join("\n");

  const html = renderAuditEmail({
    eyebrow: "Whitelist invite",
    title: `${auditor.firm_name} is on the whitelist.`,
    body: "Sign in with this email address to receive and quote audit requests from Avalanche builders.",
    cta: { label: "Sign in to the auditor portal", href: PORTAL_URL, variant: "primary" },
    footerLines: [
      "Your quotes are private to the requesting project and the program team. Other firms never see them.",
    ],
  });

  await sendMail(auditor.email, html, subject, text);
}
