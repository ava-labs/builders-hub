import sgMail from '@sendgrid/mail';
import { Client } from '@sendgrid/client';
const sgClient = new Client();
sgClient.setApiKey(process.env.SENDGRID_API_KEY as string);
if (process.env.SENDGRID_BASE_URL) {
    sgClient.setDefaultRequest('baseUrl', process.env.SENDGRID_BASE_URL);
}
sgMail.setClient(sgClient);


export async function sendMail(email: string, htmlTemplate: string,subject: string,text:string) {
    console.log('Sending email to:', email);
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
        console.error('Error sending email:', error);
        throw new Error(`Error sending email: ${error}`);
      }
}