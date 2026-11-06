import { sendMail } from './mail';
import { type EventsLang, t } from '@/lib/events/i18n';
import he from 'he';
import { BRAND, emailSection, renderEmail } from '@/server/templates/email-layout';

const escapeHtml = he.escape.bind(he);

interface HackathonContext {
  title: string;
  banner?: string;
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

  // Plain-text part keeps the raw values; only the HTML part needs escaping.
  const text = `${body} "${headline}": ${inviteLink}`;
  const safeInviterName = escapeHtml(inviterName);
  const safeHeadline = escapeHtml(headline);
  // inviteLink must be https or a relative path; strip anything else to prevent javascript: injection
  const safeLinkHref = /^https?:\/\//i.test(inviteLink) ? inviteLink : '#';
  const safeBody = escapeHtml(body);

  // Same policy as the invite link: only absolute http(s) URLs make it into the email.
  const safeBannerUrl =
    hackathon?.banner && /^https?:\/\//i.test(hackathon.banner) ? hackathon.banner : "";
  const html = renderEmail({
    title,
    product: useHackathonCopy ? 'Builder Hub events' : 'Builder Hub',
    hero: 'team',
    heroUrl: safeBannerUrl || undefined,
    accent: BRAND.gray,
    chip: 'Invitation',
    content: emailSection(
      BRAND.red,
      `<strong style="color: ${BRAND.text};">${safeInviterName}</strong> ${safeBody.replace(`${safeInviterName} `, '')} <span style="color: ${BRAND.red};">${safeHeadline}</span>`,
      '',
    ),
    cta: { label: cta, url: safeLinkHref },
    reason: escapeHtml(ignore),
  });
  try {
    await sendMail(email, html, subject, text);
  } catch (error) {
    throw new Error('Error sending project invitation email');
  }
}
