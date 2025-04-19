import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY as string);


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
        throw new Error('Error sending email');
      }
}