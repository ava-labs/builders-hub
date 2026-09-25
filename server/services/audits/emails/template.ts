import he from "he";

const escapeHtml = he.escape.bind(he);

export interface AuditEmailCta {
  label: string;
  href: string;
  variant: "primary" | "neutral";
}

export interface AuditEmailDetail {
  label: string;
  value: string;
  /** Mono slot for figures and dates, matching the product's type rules. */
  mono?: boolean;
  /** Brand-soft, for the one line that carries urgency (the closing window). */
  urgent?: boolean;
}

export interface AuditEmailPanel {
  /** Mono caps label sitting inside the raised block. */
  label: string;
  /** The paragraph the recipient actually has to read. */
  text?: string;
  rows?: AuditEmailDetail[];
}

export interface AuditEmailInput {
  eyebrow: string;
  /** Eyebrow color override, e.g. emerald for the accepted notice. */
  eyebrowColor?: string;
  title: string;
  /** Larger display treatment: the title is the only thing on its line. */
  titleLarge?: boolean;
  metaLine?: string;
  body?: string;
  /** Raised panel between body and CTA: the detail a recipient triages on. */
  panel?: AuditEmailPanel;
  cta: AuditEmailCta;
  /** Quiet companion action beside the primary CTA. */
  secondaryCta?: AuditEmailCta;
  footerLines?: string[];
}

/**
 * The shared dark-card shell for every audit-program email (mockup board E-1
 * to E-4). Inline styles only, email-client-safe (border-trick triangle, no
 * clip-path). Escaping happens HERE exactly once: senders pass raw strings
 * (emails.test.ts asserts the literal single-escaped output). This module
 * must never introduce a dollar sign of its own: the not-selected notice is
 * tested to carry no amounts.
 */
export function renderAuditEmail(input: AuditEmailInput): string {
  const eyebrowColor = input.eyebrowColor ?? "#A1A1AA";
  const buttonStyle = (variant: AuditEmailCta["variant"]) =>
    variant === "primary"
      ? "background-color: #E6212F; border: 1px solid #E6212F;"
      : "background-color: #27272A; border: 1px solid #3F3F46;";
  const button = (cta: AuditEmailCta) =>
    `<a href="${escapeHtml(cta.href)}" target="_blank" style="display: inline-block; padding: 12px 22px; ${buttonStyle(cta.variant)} color: #FFFFFF; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">${escapeHtml(cta.label)}</a>`;

  // The raised block. #27272A against the #18181B card is the "window" that
  // stops the detail reading as one flat wall of gray text, and the rows put
  // scope, size and dates where a recipient can triage them without opening
  // the portal.
  const panel = input.panel
    ? `<div style="background-color: #27272A; border: 1px solid #3F3F46; border-radius: 10px; padding: 16px 18px; margin-top: 18px;">
        <p style="font-family: 'Courier New', monospace; font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; color: #A2AFB2; margin: 0 0 10px;">${escapeHtml(input.panel.label)}</p>
        ${input.panel.text ? `<p style="font-size: 15px; line-height: 1.6; color: #FAFAFA; margin: 0 0 14px;">${escapeHtml(input.panel.text)}</p>` : ""}
        ${
          input.panel.rows && input.panel.rows.length > 0
            ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse: collapse; font-size: 13.5px;">${input.panel.rows
                .map(
                  (row) =>
                    `<tr><td style="padding: 5px 0; color: #A2AFB2; width: 118px; vertical-align: top;">${escapeHtml(row.label)}</td><td style="padding: 5px 0; color: ${row.urgent ? "#FF7F7B" : "#FAFAFA"};${row.mono ? " font-family: 'Courier New', monospace;" : ""}">${escapeHtml(row.value)}</td></tr>`,
                )
                .join("")}</table>`
            : ""
        }
      </div>`
    : "";

  const actions = input.secondaryCta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; margin-top: 18px;"><tr><td style="padding-right: 10px;">${button(input.cta)}</td><td>${button(input.secondaryCta)}</td></tr></table>`
    : `<div style="margin-top: 18px;">${button(input.cta)}</div>`;

  // A full minimal document: the color-scheme metas keep Gmail/Outlook dark
  // from auto-inverting the dark card (round-2 board X-7a).
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
</head>
<body style="margin: 0; padding: 16px 8px; background-color: #EFF0F2;">
    <div style="background-color: #18181B; color: #FAFAFA; font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 26px; border-radius: 12px; border: 1px solid #3F3F46;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
        <tr>
          <td style="width: 23px; vertical-align: top; padding-top: 1px;">
            <span style="display: inline-block; width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-bottom: 12px solid #E6212F;"></span>
          </td>
          <td style="vertical-align: top; font-family: 'Courier New', monospace; font-size: 11px; line-height: 15px; letter-spacing: 0.14em; color: #A2AFB2;">BUILDER HUB · AVA LABS AUDIT PROGRAM</td>
        </tr>
      </table>
      <p style="font-family: 'Courier New', monospace; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: ${eyebrowColor}; margin: 18px 0 0;">${escapeHtml(input.eyebrow)}</p>
      <h2 style="color: #FAFAFA; font-size: ${input.titleLarge ? "26px" : "20px"}; line-height: ${input.titleLarge ? "1.22" : "1.3"}; margin: 8px 0 0;">${escapeHtml(input.title)}</h2>
      ${input.metaLine ? `<p style="font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.7; color: #A1A1AA; margin: 10px 0 0;">${escapeHtml(input.metaLine)}</p>` : ""}
      ${input.body ? `<p style="font-size: ${input.titleLarge ? "15px" : "14px"}; line-height: 1.6; color: ${input.titleLarge ? "#E4E4E7" : "#A1A1AA"}; margin: 10px 0 0;">${escapeHtml(input.body)}</p>` : ""}
      ${panel}
      ${actions}
      ${
        input.footerLines && input.footerLines.length > 0
          ? `<div style="border-top: 1px solid #3F3F46; margin-top: 22px; padding-top: 14px;">${input.footerLines
              .map(
                (line) =>
                  `<p style="font-size: 12px; line-height: 1.65; color: #A1A1AA; margin: 0;">${escapeHtml(line)}</p>`,
              )
              .join("")}</div>`
          : ""
      }
      <div style="margin-top: 20px;"><img src="https://build.avax.network/logo-white.png" alt="Builder Hub" style="max-width: 120px;"></div>
    </div>
</body>
</html>`;
}
