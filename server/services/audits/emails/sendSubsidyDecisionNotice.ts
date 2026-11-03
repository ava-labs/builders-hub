import { sendMail } from "@/server/services/mail";
import { isFundedSubsidy } from "@/lib/audits/subsidy";
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
  /** The only decision that is ever announced (see decideSubsidy). */
  state: "approved";
  program_amount_usd: number;
  project_amount_usd: number;
  pct: number;
}

/**
 * The subsidy approval, sent to the requesting project AND to the engaged firm.
 * Besides the approval notice, the project side is pull-based (quotes wait on
 * the request page), but a funding decision is money and lands on the program's
 * schedule rather than theirs. The firm gets it because part of its fee is
 * coming from the program, which changes who it invoices. Good news only
 * (2026-10-20): decideSubsidy sends it for an approval above $0 and nothing
 * else, so there is no declined variant, and it refuses anything else itself.
 *
 * Recipients are ALWAYS resolved by the caller from a trusted row: the owner's
 * User.email and the Auditor.quote_email, never anything the request supplied.
 * The deciding admin is never named (that stays admin-side).
 */
export async function sendSubsidyDecisionNotice(
  recipientEmail: string,
  decision: SubsidyDecisionNotice,
  audience: SubsidyAudience = "project",
): Promise<void> {
  if (!isFundedSubsidy(decision)) return;
  const forFirm = audience === "auditor";
  const requestUrl = forFirm
    ? portalRequestUrl(decision.request_id)
    : ownerRequestUrl(decision.request_id);

  const subject = `The audit program is covering ${usd(decision.program_amount_usd)} of «${decision.project_name}»`;

  const text = [
    forFirm
      ? `The Ava Labs audit program approved a subsidy toward your engagement with ${decision.project_name}.`
      : `The Ava Labs audit program approved a subsidy for ${decision.project_name}.`,
    forFirm
      ? `Program covers ${usd(decision.program_amount_usd)} (${decision.pct}% of your accepted quote). The project covers ${usd(decision.project_amount_usd)}.`
      : `Program pays ${usd(decision.program_amount_usd)} (${decision.pct}% of the accepted quote). You pay ${usd(decision.project_amount_usd)}.`,
    "Payment is handled off-platform.",
    `Your request: ${requestUrl}`,
  ].join("\n");

  const html = renderAuditEmail({
    eyebrow: "Subsidy approved",
    eyebrowColor: "#34D399",
    title: `The program is covering ${usd(decision.program_amount_usd)}.`,
    body: "Payment is handled off-platform, on the terms in the accepted quote.",
    panel: {
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
    },
    cta: {
      label: forFirm ? "Open the request" : "Open your request",
      href: requestUrl,
      variant: "primary",
    },
    footerLines: [
      "Sent by the Ava Labs audit program · the full decision is on the request page.",
    ],
  });

  await sendMail(recipientEmail, html, subject, text);
}
