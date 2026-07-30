import he from "he";
import { sendMail } from "@/server/services/mail";

const escapeHtml = he.escape.bind(he);
const PORTAL_URL = "https://build.avax.network/audits/portal";

export interface FanoutAuditor {
  firm_name: string;
  quote_email: string;
}

export interface FanoutRequest {
  project_name: string;
  quote_deadline: Date | null;
  services: string[];
  nsloc: number | null;
}

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

/**
 * The fan-out notice sent to every ACTIVE whitelisted firm on submission.
 * Recipient is ALWAYS the Auditor row's quote_email, never request input.
 * Copy rule: no em dashes anywhere, "·" separates meta.
 */
export async function sendFanoutNotification(
  auditor: FanoutAuditor,
  request: FanoutRequest,
): Promise<void> {
  const subject = `«${request.project_name}» requested an audit on Avalanche Builder Hub`;
  const deadline = request.quote_deadline ? isoDate(request.quote_deadline) : null;

  const metaParts = [
    ...request.services,
    ...(request.nsloc ? [`~${request.nsloc.toLocaleString("en-US")} nSLOC`] : []),
    ...(deadline ? [`quotes close ${deadline}`] : []),
  ];
  const metaLine = metaParts.join(" · ");

  const text = [
    `${request.project_name} requested an audit · log in to quote: ${PORTAL_URL}`,
    metaLine,
    "Quotes are private to the requesting project and the program team.",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="background-color: #18181B; color: #FAFAFA; font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border-radius: 8px; border: 1px solid #3F3F46;">
      <p style="font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #A1A1AA; margin: 0 0 12px;">New audit request</p>
      <h2 style="color: #FAFAFA; font-size: 20px; margin: 0 0 8px;">«${escapeHtml(request.project_name)}» requested an audit · click to log in and quote</h2>
      ${metaLine ? `<p style="font-family: 'Courier New', monospace; font-size: 12px; color: #A1A1AA; margin: 0 0 20px;">${escapeHtml(metaLine)}</p>` : ""}
      <a href="${PORTAL_URL}" target="_blank" style="display: inline-block; padding: 12px 24px; background-color: #E6212F; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">
        Log in and quote
      </a>
      <p style="font-size: 12px; color: #A1A1AA; margin: 20px 0 0;">Your quote is private to the requesting project and the program team. Other firms never see it.</p>
      <div style="margin-top: 24px;">
        <img src="https://build.avax.network/logo-white.png" alt="Builder Hub" style="max-width: 120px;">
      </div>
    </div>
  `;

  await sendMail(auditor.quote_email, html, subject, text);
}
