import he from 'he';

/**
 * The shared Builder Hub email layout, after the Avalanche brand guide (June 2026):
 * dark #1F1F1F, red #E6212F as the only accent, gray #A2AFB2 for secondary text,
 * a heavy all-caps headline, mono eyebrows and CTAs, and the digital-blocks strip.
 * Inter stands in for Aeonik and JetBrains Mono for Aeonik Fono.
 *
 * Email clients drop <style> blocks and background images, so every style is inline
 * and the layout is tables. Images are absolute URLs under build.avax.network/email/.
 */

export const escapeHtml = he.escape.bind(he);

export const SITE = 'https://build.avax.network';
const LOGO_URL = `${SITE}/email/avalanche-logo-white.png`;

/** One hero image per email type, in public/email/. */
export type EmailHero =
  | 'notice'
  | 'welcome'
  | 'uptime'
  | 'upgrade'
  | 'expiry'
  | 'balance'
  | 'security'
  | 'signin'
  | 'team'
  | 'event';

export const BRAND = {
  red: '#E6212F',
  redLight: '#FF7F7B',
  gray: '#A2AFB2',
  text: '#FFFFFF',
  textDim: '#C9D1D3',
  line: '#333333',
  rule: '#2A2A2A',
  panel: '#1F1F1F',
  page: '#121212',
  sans: "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif",
  mono: "'JetBrains Mono', 'IBM Plex Mono', Menlo, Consolas, monospace",
} as const;

const { red, redLight, gray, text, textDim, line, rule, panel, page, sans, mono } = BRAND;

/** The status chip label and color for an accent. */
export function tone(accent: string): { label: string; color: string } {
  if (accent === red) return { label: 'Action needed', color: red };
  if (accent === redLight) return { label: 'Warning', color: redLight };
  return { label: 'Notice', color: gray };
}

/** Emoji stay in subject lines only. The email body follows the brand: no emoji. */
export function stripEmoji(value: string): string {
  return value.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim();
}

/** The digital-blocks pattern: flat red and gray blocks cascading down and to the right. */
function blocksStrip(): string {
  const rows = [
    [0, 0, 0, gray, 0, 0, red, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, gray, 0, 0, red, red, 0, gray, 0],
  ];
  return rows
    .map(
      (cells) =>
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;"><tr>${cells
          .map(
            (c) =>
              `<td width="50" height="5" style="width: 50px; height: 5px; line-height: 5px; font-size: 0; background-color: ${c || panel};">&nbsp;</td>`,
          )
          .join('')}</tr></table>`,
    )
    .join('');
}

/** A heavy all-caps headline whose final period is in the accent color. */
function displayHeadline(title: string, accent: string): string {
  const words = escapeHtml(stripEmoji(title).replace(/[.!?:]+$/, '')).toUpperCase();
  return `<h1 style="margin: 14px 0 0 0; font-family: ${sans}; font-size: 38px; line-height: 0.98; font-weight: 900; letter-spacing: -0.015em; color: ${text};">${words}<span style="color: ${accent};">.</span></h1>`;
}

export function emailButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top: 8px;"><tr>
    <td style="background-color: ${red};"><a href="${escapeHtml(url)}" style="display: inline-block; padding: 15px 24px; font-family: ${mono}; font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; color: ${text}; text-decoration: none;">${escapeHtml(label)} &rarr;</a></td>
  </tr></table>`;
}

export function renderEmail(opts: {
  /** The page title and the display headline. */
  title: string;
  /** Small mono label at the top right, e.g. "Validator alerts". */
  product: string;
  hero: EmailHero;
  /** An absolute https image that replaces the hero, e.g. a hackathon banner. */
  heroUrl?: string;
  /** Accent: BRAND.red (action needed), BRAND.redLight (warning) or anything else (notice). */
  accent?: string;
  /** Chip text. Defaults to the tone label of the accent. */
  chip?: string;
  content: string;
  cta?: { label: string; url: string };
  /** Why the reader gets this email. */
  reason?: string;
  unsubscribeUrl?: string;
}): string {
  const accent = opts.accent ?? red;
  const t = tone(accent);
  const chip = opts.chip ?? t.label;
  const title = stripEmoji(opts.title);
  const footerLinks = [
    opts.reason ? `<p style="margin: 0 0 10px 0; font-size: 12px; line-height: 1.5; color: ${gray};">${opts.reason}</p>` : '',
    opts.unsubscribeUrl
      ? `<p style="margin: 0; font-size: 12px;"><a href="${opts.unsubscribeUrl}" style="color: ${gray}; text-decoration: underline;">Unsubscribe from these alerts</a></p>`
      : '',
  ].join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800;900&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; background-color: ${page};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: ${page};">
<tr><td align="center" style="padding: 28px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px; background-color: ${panel}; border-collapse: collapse; font-family: ${sans}; color: ${text};">
  <tr>
    <td style="padding: 22px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td align="left"><a href="${SITE}"><img src="${LOGO_URL}" width="118" alt="Avalanche" style="display: block; border: 0; width: 118px; height: auto;"></a></td>
        <td align="right" style="font-family: ${mono}; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: ${gray};">${escapeHtml(opts.product)}</td>
      </tr></table>
    </td>
  </tr>
  <tr><td style="padding: 0; line-height: 0; font-size: 0;"><img src="${opts.heroUrl && /^https:\/\//i.test(opts.heroUrl) ? escapeHtml(opts.heroUrl) : `${SITE}/email/hero-${opts.hero}.jpg`}" width="600" alt="" style="display: block; width: 100%; max-width: 600px; height: auto; border: 0;"></td></tr>
  <tr><td style="padding: 0;">${blocksStrip()}</td></tr>
  <tr>
    <td style="padding: 34px 32px 36px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="border-left: 1px solid ${rule}; padding-left: 22px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="font-family: ${mono}; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: ${page}; background-color: ${t.color}; padding: 5px 9px;">${escapeHtml(chip)}</td>
          </tr></table>
          ${displayHeadline(title, accent)}
          ${opts.content}
          ${opts.cta ? emailButton(opts.cta.label, opts.cta.url) : ''}
        </td>
      </tr></table>
    </td>
  </tr>
  <tr>
    <td style="padding: 22px 32px 28px 32px; border-top: 1px solid ${line};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td align="left" style="font-family: ${mono}; font-size: 10px; line-height: 1.5; letter-spacing: 0.14em; text-transform: uppercase; color: ${gray};">Technology built<br>for business.</td>
        <td align="right" style="font-family: ${mono}; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;"><a href="${SITE}" style="color: ${red}; text-decoration: none;">&rarr; build.avax.network</a></td>
      </tr></table>
      ${footerLinks ? `<div style="margin-top: 18px;">${footerLinks}</div>` : ''}
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** The lead sentence under the headline, then the body and an optional footnote. */
export function emailSection(accent: string, lead: string, body: string, footnote?: string): string {
  return `
    <p style="margin: 18px 0 22px 0; font-family: ${sans}; font-size: 19px; line-height: 1.35; font-weight: 500; color: ${text};">${stripEmoji(lead).replace(/[.!?]+$/, '')}<span style="color: ${tone(accent).color};">.</span></p>
    <div style="font-size: 15px; line-height: 1.55; color: ${textDim};">${body}</div>
    ${footnote ? `<p style="margin: 6px 0 22px 0; font-size: 13px; line-height: 1.5; color: ${gray};">${footnote}</p>` : ''}`;
}

export function emailDataRow(label: string, value: string, valueColor: string = text): string {
  return `
    <tr>
      <td style="padding: 13px 0; border-top: 1px solid ${line}; font-family: ${mono}; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: ${gray}; vertical-align: top;">${escapeHtml(label)}</td>
      <td style="padding: 13px 0 13px 16px; border-top: 1px solid ${line}; font-size: 15px; font-weight: 700; color: ${valueColor}; text-align: right; word-break: break-all;">${escapeHtml(value)}</td>
    </tr>`;
}

export function emailDataTable(rows: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; border-collapse: collapse; border-bottom: 1px solid ${line}; margin: 0 0 18px 0;">${rows}</table>`;
}

/** A large one-time code, spaced for reading and copying. */
export function emailCode(code: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 6px 0 22px 0;"><tr>
    <td style="border: 1px solid ${line}; border-left: 3px solid ${red}; padding: 18px 26px; font-family: ${mono}; font-size: 34px; font-weight: 500; letter-spacing: 0.32em; color: ${text};">${escapeHtml(code)}</td>
  </tr></table>`;
}
