import { sendMail } from "@/server/services/mail";
import { renderAuditEmail } from "@/server/services/audits/emails/template";
import { ownerRequestUrl } from "@/server/services/audits/emails/links";

const usd = (value: number) => `$${value.toLocaleString("en-US")}`;

export interface SubsidyDecisionNotice {
  request_id: string;
  project_name: string;
  state: "approved" | "declined";
  program_amount_usd: number;
  project_amount_usd: number;
  pct: number;
}

/**
 * The ONE email the requesting project ever receives. Everything else on the
 * project side is pull-based ("no emails to you, check back here"), but a
 * funding decision is money and arrives on the program's schedule, not
 * theirs, so silence would leave a team waiting on an answer they have no way
 * to know has landed.
 *
 * Recipient is ALWAYS the account email of the request owner, resolved from
 * the User row by the caller: never request input, so a wizard field can
 * never point this at a third party. The deciding admin's name is not in
 * here (it stays admin-side, per the locked decision); the declined variant
 * carries no amounts at all, mirroring the not-selected notice.
 */
export async function sendSubsidyDecisionNotice(
  recipientEmail: string,
  decision: SubsidyDecisionNotice,
): Promise<void> {
  const requestUrl = ownerRequestUrl(decision.request_id);
  const approved = decision.state === "approved";

  const subject = approved
    ? `The audit program is covering ${usd(decision.program_amount_usd)} of «${decision.project_name}»`
    : `Subsidy decision for «${decision.project_name}»`;

  const text = approved
    ? [
        `The Ava Labs audit program approved a subsidy for ${decision.project_name}.`,
        `Program pays ${usd(decision.program_amount_usd)} (${decision.pct}% of the accepted quote). You pay ${usd(decision.project_amount_usd)}.`,
        "Payment is handled off-platform with the firm.",
        `Your request: ${requestUrl}`,
      ].join("\n")
    : [
        `The Ava Labs audit program did not approve a subsidy for ${decision.project_name}.`,
        "This does not affect your engagement: the quote you accepted stands and the audit goes ahead as agreed with the firm.",
        `Your request: ${requestUrl}`,
      ].join("\n");

  const html = renderAuditEmail({
    eyebrow: approved ? "Subsidy approved" : "Subsidy decision",
    eyebrowColor: approved ? "#34D399" : undefined,
    title: approved
      ? `The program is covering ${usd(decision.program_amount_usd)}.`
      : "A subsidy was not approved.",
    body: approved
      ? "Payment is handled off-platform with the firm, on the terms in their quote."
      : "This does not affect your engagement: the quote you accepted stands and the audit goes ahead as agreed with the firm.",
    panel: approved
      ? {
          label: `Subsidy · ${decision.project_name}`,
          rows: [
            { label: "Program pays", value: usd(decision.program_amount_usd), mono: true },
            { label: "Share", value: `${decision.pct}% of the accepted quote`, mono: true },
            { label: "You pay", value: usd(decision.project_amount_usd), mono: true },
          ],
        }
      : undefined,
    cta: {
      label: "Open your request",
      href: requestUrl,
      variant: approved ? "primary" : "neutral",
    },
    footerLines: [
      "Sent by the Ava Labs audit program · the full decision is on your request page.",
    ],
  });

  await sendMail(recipientEmail, html, subject, text);
}
