import { sendMail } from "@/server/services/mail";
import { renderAuditEmail } from "@/server/services/audits/emails/template";

const PORTAL_URL = "https://build.avax.network/audits/portal";

/**
 * Sent to the WINNING firm after acceptance (design iteration 2026-07-31:
 * previously only losers were notified). Portal link only: contacts reveal
 * inside the portal, so a forwarded email leaks nothing. Recipient is ALWAYS
 * the Auditor row's quote_email.
 */
export async function sendQuoteAcceptedNotice(
  auditor: { firm_name: string; quote_email: string },
  request: { id: string; project_name: string },
): Promise<void> {
  const requestUrl = `${PORTAL_URL}/requests/${request.id}`;
  const subject = `«${request.project_name}» accepted your quote`;
  const text = [
    `${request.project_name} accepted your quote. Contacts are revealed to both sides in the auditor portal: ${requestUrl}`,
    "The engagement continues off-platform under the program's standardized terms.",
  ].join("\n");

  const html = renderAuditEmail({
    eyebrow: "Quote accepted",
    eyebrowColor: "#34D399",
    title: `«${request.project_name}» accepted your quote.`,
    body: "Contacts are revealed to both sides in the auditor portal. The engagement continues off-platform under the program's standardized terms.",
    cta: { label: "Open the request", href: requestUrl, variant: "primary" },
    footerLines: [
      "The project's contact is waiting in the portal · nothing sensitive travels in this email.",
    ],
  });

  await sendMail(auditor.quote_email, html, subject, text);
}
