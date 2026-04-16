import { sendMail } from './mail';
import { type EventsLang, t } from '@/lib/events/i18n';

export async function sendInvitation(
  email: string,
  projectName: string,
  inviterName: string,
  inviteLink: string,
  lang: EventsLang = "en"
) {
  const subject = t(lang, "invitation.email.subject", { projectName });
  const body = t(lang, "invitation.email.body", { inviterName });
  const title = t(lang, "invitation.email.title");
  const cta = t(lang, "invitation.email.cta");
  const ignore = t(lang, "invitation.email.ignore");
  const footer = t(lang, "invitation.email.footer");

  const text = `${body} "${projectName}" — ${inviteLink}`;
  const html = `
    <div style="background-color: #18181B; color: white; font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border-radius: 8px; border: 1px solid #EF4444; text-align: center;">
      <h2 style="color: white; font-size: 20px; margin-bottom: 16px;">${title}</h2>

      <div style="background-color: #27272A; border: 1px solid #EF4444; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <p style="font-size: 16px; color: #F87171; margin-bottom: 10px;">
          <strong>${inviterName}</strong> ${body.replace(`${inviterName} `, '')}
        </p>
        <p style="font-size: 20px; font-weight: bold; color: #EF4444; margin: 8px 0;">"${projectName}"</p>
        <a href="${inviteLink}" target="_blank" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background-color: #EF4444; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">
          ${cta}
        </a>
      </div>

      <p style="font-size: 12px; color: #A1A1AA;">${ignore}</p>

      <div style="margin-top: 20px;">
        <img src="https://build.avax.network/logo-white.png" alt="Company Logo" style="max-width: 120px; margin-bottom: 10px;">
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
