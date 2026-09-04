import { renderAuditEmail } from "@/server/services/audits/emails/template";
import { PORTAL_URL } from "@/server/services/audits/emails/links";
import {
  recipientsOf,
  sendToFirm,
  type FirmRecipient,
} from "@/server/services/audits/emails/recipients";

/**
 * Sent to each losing firm after acceptance. Plain by design: no reason, no
 * winner identity, no amounts, neutral CTA. Recipients are ALWAYS the firm's
 * quote email plus its approved teammates. Escaping lives in the shared
 * template.
 */
export async function sendNotSelectedNotice(
  auditor: FirmRecipient,
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

  await sendToFirm(recipientsOf(auditor), html, subject, text);
}
