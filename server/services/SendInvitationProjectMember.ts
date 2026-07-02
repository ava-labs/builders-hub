import { sendMail } from './mail';
import { type EventsLang, t } from '@/lib/events/i18n';

interface HackathonContext {
  title: string;
  banner?: string;
}

// Generic hosted hackathon banner (same fallback the event page uses).
const DEFAULT_BANNER_URL =
  'https://qizat5l3bwvomkny.public.blob.vercel-storage.com/builders-hub/hackathon-images/main_banner_img-crBsoLT7R07pdstPKvRQkH65yAbpFX.png';

// Minimal escaping for values interpolated into HTML attributes/text below —
// hackathon title and banner come from the DB, not from the email recipient,
// but they must not be able to break out of the markup.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Only hosted images render reliably in email: data-URI banners are blocked
// by most clients and can push the HTML past Gmail's ~102KB clipping limit,
// so anything that isn't a well-formed absolute http(s) URL falls back to the
// generic banner.
function resolveBannerUrl(banner?: string): string {
  const trimmed = (banner ?? '').trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return DEFAULT_BANNER_URL;
    }
  } catch {
    return DEFAULT_BANNER_URL;
  }
  return escapeHtml(trimmed);
}

export async function sendInvitation(
  email: string,
  projectName: string,
  inviterName: string,
  inviteLink: string,
  lang: EventsLang = "en",
  hackathon?: HackathonContext,
) {
  const useHackathonCopy = !!hackathon?.title;
  const subject = useHackathonCopy
    ? t(lang, "invitation.email.subjectHackathon", {
        inviterName,
        hackathonTitle: hackathon!.title,
      })
    : t(lang, "invitation.email.subject", { projectName });
  const title = useHackathonCopy
    ? t(lang, "invitation.email.titleHackathon")
    : t(lang, "invitation.email.title");
  const cta = useHackathonCopy
    ? t(lang, "invitation.email.ctaHackathon")
    : t(lang, "invitation.email.cta");
  const body = useHackathonCopy
    ? t(lang, "invitation.email.bodyHackathon", { inviterName })
    : t(lang, "invitation.email.body", { inviterName });
  const headline = useHackathonCopy ? hackathon!.title : projectName;
  const ignore = t(lang, "invitation.email.ignore");
  const footer = t(lang, "invitation.email.footer");

  const text = `${body} "${headline}" — ${inviteLink}`;
  const bannerHtml = useHackathonCopy
    ? `<img src="${resolveBannerUrl(hackathon?.banner)}" alt="${escapeHtml(hackathon!.title)}" style="width: 100%; max-height: 160px; object-fit: cover; border-radius: 8px 8px 0 0; margin-bottom: 0;">`
    : "";
  const html = `
    <div style="background-color: #18181B; color: white; font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border-radius: 8px; border: 1px solid #EF4444; text-align: center;">
      ${bannerHtml}
      <h2 style="color: white; font-size: 20px; margin: ${bannerHtml ? "16px 0" : "0 0 16px"};">${title}</h2>

      <div style="background-color: #27272A; border: 1px solid #EF4444; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <p style="font-size: 16px; color: #F87171; margin-bottom: 10px;">
          <strong>${escapeHtml(inviterName)}</strong> ${escapeHtml(body.replace(`${inviterName} `, ''))}
        </p>
        <p style="font-size: 20px; font-weight: bold; color: #EF4444; margin: 8px 0;">"${escapeHtml(headline)}"</p>
        <a href="${inviteLink}" target="_blank" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #EF4444; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">
          ${cta}
        </a>
      </div>

      <p style="font-size: 12px; color: #A1A1AA;">${ignore}</p>

      <div style="margin-top: 20px;">
        <img src="https://build.avax.network/logo-white.png" alt="Builder Hub" style="max-width: 120px; margin-bottom: 10px;">
        <p style="font-size: 12px; color: #A1A1AA;">${footer}</p>
      </div>
    </div>
    `;
  try {
    await sendMail(email, html, subject, text);
  } catch (error) {
    throw new Error('Error sending project invitation email');
  }
}
