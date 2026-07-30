import he from "he";
import { sendMail } from "@/server/services/mail";

const escapeHtml = he.escape.bind(he);
const PORTAL_URL = "https://build.avax.network/audits/portal";

export interface InviteAuditor {
  firm_name: string;
  quote_email: string;
}

/**
 * Sent when an admin adds a firm to the whitelist (and on resend). The
 * 6-digit OTP itself comes from the existing sign-in flow; this only carries
 * the instruction and the portal link. Recipient is ALWAYS the Auditor row's
 * quote_email. Plain functional HTML v1; a designed template is a later
 * round.
 */
export async function sendAuditorInvite(auditor: InviteAuditor): Promise<void> {
  const subject = "You've been added to the Avalanche audit marketplace";
  const text = [
    `${auditor.firm_name} is now on the Ava Labs audit whitelist.`,
    `Sign in with this email address to receive and quote audit requests: ${PORTAL_URL}`,
    "Your quotes are private to the requesting project and the program team.",
  ].join("\n");

  const html = `
    <div style="background-color: #18181B; color: #FAFAFA; font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border-radius: 8px; border: 1px solid #3F3F46;">
      <p style="font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #A1A1AA; margin: 0 0 12px;">Ava Labs audit program</p>
      <h2 style="color: #FAFAFA; font-size: 20px; margin: 0 0 8px;">${escapeHtml(auditor.firm_name)} is on the whitelist.</h2>
      <p style="font-size: 14px; color: #A1A1AA; margin: 0 0 20px;">Sign in with this email address to receive and quote audit requests from Avalanche builders.</p>
      <a href="${PORTAL_URL}" target="_blank" style="display: inline-block; padding: 12px 24px; background-color: #E6212F; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">
        Sign in to the auditor portal
      </a>
      <p style="font-size: 12px; color: #A1A1AA; margin: 20px 0 0;">Your quotes are private to the requesting project and the program team. Other firms never see them.</p>
      <div style="margin-top: 24px;">
        <img src="https://build.avax.network/logo-white.png" alt="Builder Hub" style="max-width: 120px;">
      </div>
    </div>
  `;

  await sendMail(auditor.quote_email, html, subject, text);
}
