import { generate6DigitCode } from '@/lib/auth/authOptions';
import { prisma } from '@/prisma/prisma';
import { EmailParams, Sender, Recipient, MailerSend } from 'mailersend';
const mailersend = new MailerSend({
  apiKey: process.env.MAILERSEND_API_TOKEN as string,
});

export async function sendOTP(email: string) {
  const code = generate6DigitCode();
  await prisma.verificationToken.upsert({
    where: { identifier_token: { identifier: email, token: code } },
    update: {
      token: code,
      expires: new Date(Date.now() + 3 * 60 * 1000),
    },
    create: {
      identifier: email,
      token: code,
      expires: new Date(Date.now() + 3 * 60 * 1000),
    },
  });

  const sender = new Sender(
    process.env.EMAIL_FROM as string,
    "Avalanche Builder's Hub"
  );
  const recipients = [new Recipient(email, 'Usuario')];

  const emailParams = new EmailParams({
    from: sender,
    to: recipients,
    subject: 'Verify Your Account',
    text: `Your verification code is: ${code}. It expires in 3 minutes.`,
    html: `
    <div style="background-color: #18181B; color: white; font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border-radius: 8px; border: 1px solid #EF4444; text-align: center;">
      <h2 style="color: white; font-size: 20px; margin-bottom: 16px;"> Verify Your Account</h2>
      
      <div style="background-color: #27272A; border: 1px solid #EF4444; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <p style="font-size: 16px; color: #F87171; margin-bottom: 10px;">Use this code to verify your account:</p>
        <p style="font-size: 24px; font-weight: bold; color: #EF4444; margin-bottom: 20px;">${code}</p>
        <p style="font-size: 14px; color: #D1D5DB;">This code expires in <strong>3 minutes</strong>.</p>
      </div>

      <p style="font-size: 12px; color: #A1A1AA;">If you did not request this, you can ignore this email.</p>

      <div style="margin-top: 20px;">
        <img src="https://build.avax.network/logo-white.png" alt="Company Logo" style="max-width: 120px; margin-bottom: 10px;">
        <p style="font-size: 12px; color: #A1A1AA;">Avalanche Builder's Hub &copy; 2025</p>
      </div>
    </div>
  `,
  });

  try {
    await mailersend.email.send(emailParams);
  } catch (error) {
    throw new Error('Error sending email');
  }
}
