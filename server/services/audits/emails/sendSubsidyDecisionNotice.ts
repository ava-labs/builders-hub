import { sendMail } from "@/server/services/mail";
import { renderAuditEmail } from "@/server/services/audits/emails/template";
import { ownerRequestUrl, portalRequestUrl } from "@/server/services/audits/emails/links";

const usd = (value: number) => `$${value.toLocaleString("en-US")}`;

/** Who is reading. Both sides get the same figures; only the framing and the
    link differ, because "you pay" is false for the firm and the project has no
    business landing in the auditor portal. */
export type SubsidyAudience = "project" | "auditor";

export interface SubsidyDecisionNotice {
  request_id: string;
  project_name: string;
  state: "approved" | "declined";
  program_amount_usd: number;
  project_amount_usd: number;
  pct: number;
}

/**
 * The subsidy outcome, sent to the requesting project AND to the engaged firm.
 * Everything else on the project side is pull-based ("no emails to you, check
 * back here"), but a funding decision is money and lands on the program's
 * schedule rather than theirs, so silence leaves people waiting on an answer
 * they cannot see. The firm gets it because part of its fee may be coming from
 * the program, which changes who it invoices.
 *
 * Recipients are ALWAYS resolved by the caller from a trusted row: the owner's
 * User.email and the Auditor.quote_email, never anything the request supplied.
 * No amounts travel in the declined variant, mirroring the not-selected
 * notice, and the deciding admin is never named (that stays admin-side).
 */
export async function sendSubsidyDecisionNotice(
  recipientEmail: string,
  decision: SubsidyDecisionNotice,
  audience: SubsidyAudience = "project",
): Promise<void> {
  const forFirm = audience === "auditor";
  const requestUrl = forFirm
    ? portalRequestUrl(decision.request_id)
    : ownerRequestUrl(decision.request_id);
  const approved = decision.state === "approved";

  const subject = approved
    ? `The audit program is covering ${usd(decision.program_amount_usd)} of «${decision.project_name}»`
    : `Subsidy decision for «${decision.project_name}»`;

  const declinedBody = forFirm
    ? "The engagement is unaffected: your accepted quote and payment terms with the project stand exactly as agreed."
    : "This does not affect your engagement: the quote you accepted stands and the audit goes ahead as agreed with the firm.";

  const text = approved
    ? [
        forFirm
          ? `The Ava Labs audit program approved a subsidy toward your engagement with ${decision.project_name}.`
          : `The Ava Labs audit program approved a subsidy for ${decision.project_name}.`,
        forFirm
          ? `Program covers ${usd(decision.program_amount_usd)} (${decision.pct}% of your accepted quote). The project covers ${usd(decision.project_amount_usd)}.`
          : `Program pays ${usd(decision.program_amount_usd)} (${decision.pct}% of the accepted quote). You pay ${usd(decision.project_amount_usd)}.`,
        "Payment is handled off-platform.",
        `Your request: ${requestUrl}`,
      ].join("\n")
    : [
        `The Ava Labs audit program did not approve a subsidy for ${decision.project_name}.`,
        declinedBody,
        `Your request: ${requestUrl}`,
      ].join("\n");

  const html = renderAuditEmail({
    eyebrow: approved ? "Subsidy approved" : "Subsidy decision",
    eyebrowColor: approved ? "#34D399" : undefined,
    title: approved
      ? `The program is covering ${usd(decision.program_amount_usd)}.`
      : "A subsidy was not approved.",
    body: approved
      ? "Payment is handled off-platform, on the terms in the accepted quote."
      : declinedBody,
    panel: approved
      ? {
          label: `Subsidy · ${decision.project_name}`,
          rows: [
            {
              label: forFirm ? "Program covers" : "Program pays",
              value: usd(decision.program_amount_usd),
              mono: true,
            },
            { label: "Share", value: `${decision.pct}% of the accepted quote`, mono: true },
            {
              label: forFirm ? "Project covers" : "You pay",
              value: usd(decision.project_amount_usd),
              mono: true,
            },
          ],
        }
      : undefined,
    cta: {
      label: forFirm ? "Open the request" : "Open your request",
      href: requestUrl,
      variant: approved ? "primary" : "neutral",
    },
    footerLines: [
      "Sent by the Ava Labs audit program · the full decision is on the request page.",
    ],
  });

  await sendMail(recipientEmail, html, subject, text);
}
