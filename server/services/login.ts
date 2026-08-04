import { generate6DigitCode } from '@/lib/auth/authOptions';
import { prisma } from '@/prisma/prisma';
import { sendMail } from '@/server/services/mail';

export async function sendOTP(email: string) {
  const code = generate6DigitCode();
  // Delete any existing OTPs for this email so only one valid code exists at a time.
  // The old upsert keyed on (identifier, token) never matched (token is random) and
  // silently accumulated unlimited live codes, enabling brute-force attacks.
  await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: code,
      expires: new Date(Date.now() + 3 * 60 * 1000),
    },
  });

  if (process.env.NODE_ENV === 'development') {
    console.log('\n' + '='.repeat(50));
    console.log('📧 \x1b[36m%s\x1b[0m', 'OTP EMAIL (DEVELOPMENT MODE)');
    console.log('='.repeat(50));
    console.log('📬 To: \x1b[33m%s\x1b[0m', email);
    console.log('🔑 Code: \x1b[1m\x1b[32m%s\x1b[0m', code);
    console.log('⏰ Expires: \x1b[31m%s\x1b[0m', '3 minutes');
    console.log('='.repeat(50) + '\n');
    return;
  }

  const html = `
    <div style="background-color: #18181B; color: white; font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border-radius: 8px; border: 1px solid #EF4444; text-align: center;">
      <h2 style="color: white; font-size: 20px; margin-bottom: 16px;"> Verify Your Account</h2>
      
      <div style="background-color: #27272A; border: 1px solid #EF4444; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <p style="font-size: 16px; color: #F87171; margin-bottom: 10px;">Use this code to verify your account:</p>
        <p style="font-size: 24px; font-weight: bold; color: #EF4444; margin-bottom: 20px;">${code}</p>
        <p style="font-size: 14px; color: #D1D5DB;">This code expires in <strong>3 minutes</strong>.</p>
      </div>

      <p style="font-size: 12px; color: #A1A1AA;">If you did not request this, you can ignore this email.</p>

      <div style="margin-top: 20px;">
        <img src="https://build.avax.network/logo-black.png" alt="Company Logo" style="max-width: 120px; margin-bottom: 10px;">
        <p style="font-size: 12px; color: #A1A1AA;">Avalanche Builder's Hub © 2025</p>
      </div>
    </div>
  `;

  await sendMail(email, html, 'Verify Your Account', `Your verification code is: ${code}. It expires in 3 minutes.`);
}
