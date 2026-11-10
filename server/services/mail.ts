import sgMail from '@sendgrid/mail';
import { Client } from '@sendgrid/client';
const sgClient = new Client();
sgClient.setApiKey(process.env.SENDGRID_API_KEY as string);
if (process.env.SENDGRID_BASE_URL) {
    sgClient.setDefaultRequest('baseUrl', process.env.SENDGRID_BASE_URL);
}
sgMail.setClient(sgClient);


/**
 * `logRecipient: false` keeps the address out of the logs, for scripts that must not
 * print personal data (scripts/notify-migration/import.ts).
 */
export async function sendMail(
  email: string,
  htmlTemplate: string,
  subject: string,
  text: string,
  { logRecipient = true }: { logRecipient?: boolean } = {},
) {
    if (logRecipient) console.log('Sending email to:', email);
    const from = {
        email: process.env.EMAIL_FROM as string,
        name: "Avalanche Builder's Hub"
      };
    
      const msg = {
        to: email,
        from: from,
        subject: subject,
        text: text,       
        html: htmlTemplate,
      };
    
      try {
        await sgMail.send(msg);
      } catch (error) {
        // A provider error can quote the recipient.
        const detail = logRecipient ? error : ((error as { code?: unknown })?.code ?? 'unknown');
        console.error('Error sending email:', detail);
        throw new Error(`Error sending email: ${detail}`);
      }
}