import { sendMail } from "@/server/services/mail";
import { renderAuditEmail } from "@/server/services/audits/emails/template";

const PORTAL_URL = "https://build.avax.network/audits/portal";

/**
 * Sent to each losing firm after acceptance. Plain by design: no reason, no
 * winner identity, no amounts, neutral CTA. Recipient is ALWAYS the Auditor
 * row's quote_email. Escaping lives in the shared template.
 */
export async function sendNotSelectedNotice(
  auditor: { firm_name: string; quote_email: string },
  request: { project_name: string },
): Promise<void> {
  const subject = `«${request.project_name}» chose another provider`;
  const text = [
    `${request.project_name} chose another provider for this request. No further action is needed.`,
    `Your quote stays private, and new requests keep arriving in your inbox: ${PORTAL_URL}`,
  ].join("\n");

  const html = renderAuditEmail({
    eyebrow: "Request closed",
    title: `«${request.project_name}» chose another provider.`,
    body: "No further action is needed. Your quote stays private to the project and the program team, and new requests keep arriving in your inbox.",
    cta: { label: "Open the auditor portal", href: PORTAL_URL, variant: "neutral" },
    footerLines: [
      "Your firm stays on the whitelist · every new request fans out to you automatically.",
    ],
  });

  await sendMail(auditor.quote_email, html, subject, text);
}
