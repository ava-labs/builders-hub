import { sendMail } from "@/server/services/mail";
import { renderAuditEmail } from "@/server/services/audits/emails/template";
import { PORTAL_URL } from "@/server/services/audits/emails/links";

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
 * Copy rule: no em dashes anywhere, "·" separates meta. Escaping lives in
 * the shared template.
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

  const html = renderAuditEmail({
    eyebrow: "New audit request",
    title: `«${request.project_name}» requested an audit`,
    metaLine: metaLine || undefined,
    cta: { label: "Log in and quote", href: PORTAL_URL, variant: "primary" },
    footerLines: [
      "Your quote is private to the requesting project and the program team. Other firms never see it.",
      "Your firm is on the Ava Labs whitelist · fan-out notices arrive at this address.",
    ],
  });

  await sendMail(auditor.quote_email, html, subject, text);
}
