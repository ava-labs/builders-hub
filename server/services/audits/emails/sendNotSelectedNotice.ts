import he from "he";
import { sendMail } from "@/server/services/mail";

const escapeHtml = he.escape.bind(he);
const PORTAL_URL = "https://build.avax.network/audits/portal";

/**
 * Sent to each losing firm after acceptance. Plain by design: no reason, no
 * winner identity, no amounts. Recipient is ALWAYS the Auditor row's
 * quote_email.
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

  const html = `
    <div style="background-color: #18181B; color: #FAFAFA; font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border-radius: 8px; border: 1px solid #3F3F46;">
      <p style="font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #A1A1AA; margin: 0 0 12px;">Ava Labs audit program</p>
      <h2 style="color: #FAFAFA; font-size: 20px; margin: 0 0 8px;">«${escapeHtml(request.project_name)}» chose another provider.</h2>
      <p style="font-size: 14px; color: #A1A1AA; margin: 0 0 20px;">No further action is needed. Your quote stays private to the project and the program team, and new requests keep arriving in your inbox.</p>
      <a href="${PORTAL_URL}" target="_blank" style="display: inline-block; padding: 12px 24px; background-color: #27272A; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; border: 1px solid #3F3F46;">
        Open the auditor portal
      </a>
      <div style="margin-top: 24px;">
        <img src="https://build.avax.network/logo-white.png" alt="Builder Hub" style="max-width: 120px;">
      </div>
    </div>
  `;

  await sendMail(auditor.quote_email, html, subject, text);
}
