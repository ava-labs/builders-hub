import he from "he";

const escapeHtml = he.escape.bind(he);

export interface AuditEmailCta {
  label: string;
  href: string;
  variant: "primary" | "neutral";
}

export interface AuditEmailInput {
  eyebrow: string;
  /** Eyebrow color override, e.g. emerald for the accepted notice. */
  eyebrowColor?: string;
  title: string;
  metaLine?: string;
  body?: string;
  cta: AuditEmailCta;
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
  const ctaStyle =
    input.cta.variant === "primary"
      ? "background-color: #E6212F; border: 1px solid #E6212F;"
      : "background-color: #27272A; border: 1px solid #3F3F46;";

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
      <div>
        <span style="display: inline-block; vertical-align: middle; width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-bottom: 12px solid #E6212F;"></span>
        <span style="display: inline-block; vertical-align: middle; margin-left: 9px; font-family: 'Courier New', monospace; font-size: 11px; letter-spacing: 0.14em; color: #A2AFB2;">BUILDER HUB · AVA LABS AUDIT PROGRAM</span>
      </div>
      <p style="font-family: 'Courier New', monospace; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: ${eyebrowColor}; margin: 18px 0 0;">${escapeHtml(input.eyebrow)}</p>
      <h2 style="color: #FAFAFA; font-size: 20px; line-height: 1.3; margin: 8px 0 0;">${escapeHtml(input.title)}</h2>
      ${input.metaLine ? `<p style="font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.7; color: #A1A1AA; margin: 10px 0 0;">${escapeHtml(input.metaLine)}</p>` : ""}
      ${input.body ? `<p style="font-size: 14px; line-height: 1.65; color: #A1A1AA; margin: 10px 0 0;">${escapeHtml(input.body)}</p>` : ""}
      <a href="${escapeHtml(input.cta.href)}" target="_blank" style="display: inline-block; margin-top: 18px; padding: 12px 24px; ${ctaStyle} color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px;">${escapeHtml(input.cta.label)}</a>
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
