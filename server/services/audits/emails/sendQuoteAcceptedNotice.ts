import { renderAuditEmail } from "@/server/services/audits/emails/template";
import { portalRequestUrl } from "@/server/services/audits/emails/links";
import {
  recipientsOf,
  sendToFirm,
  type FirmRecipient,
} from "@/server/services/audits/emails/recipients";

/**
 * Sent to the WINNING firm after acceptance (design iteration 2026-07-31:
 * previously only losers were notified). Portal link only: contacts reveal
 * inside the portal, so a forwarded email leaks nothing. Recipients are ALWAYS
 * the firm's quote email plus its approved teammates.
 */
export async function sendQuoteAcceptedNotice(
  auditor: FirmRecipient,
  request: { id: string; project_name: string },
): Promise<void> {
  const requestUrl = portalRequestUrl(request.id);
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

  await sendToFirm(recipientsOf(auditor), html, subject, text);
}
