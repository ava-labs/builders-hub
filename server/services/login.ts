import { randomUUID } from 'crypto';
import { generate6DigitCode } from '@/lib/auth/authOptions';
import { tryAdvisoryLock } from '@/lib/db/advisoryLock';
import { prisma } from '@/prisma/prisma';
import { sendMail } from '@/server/services/mail';

const OTP_TTL_MS = 3 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

/**
 * Mails allowed per address. Each send is a VerificationToken row under this
 * prefix, so the cap needs no schema change. A valid email cannot contain ':',
 * so the rows never collide with a live code. There is no cap per client IP:
 * a hackathon venue often puts many users behind one IP. Leave volume per
 * client to a rate-limit rule at the edge.
 */
const OTP_SEND_PREFIX = 'otp-send:';
const OTP_SEND_WINDOW_MS = 15 * 60 * 1000;
const OTP_SEND_MAX = 5;

/** Each send deletes VerificationToken rows that expired this long ago. */
const OTP_SWEEP_AGE_MS = 60 * 60 * 1000;

export type SendOTPResult =
  | { status: 'sent' }
  | { status: 'recent' }
  | { status: 'limited'; retryAfterSeconds: number };

/**
 * Mails a sign-in code to `email`.
 *
 * A resend mails the live code again instead of replacing it. A replaced code
 * locks out the user who is typing it, and anyone can request a send for any
 * address. A send within a minute of the last one mails nothing and reports
 * 'recent', so the client goes on to the code step.
 */
export async function sendOTP(email: string): Promise<SendOTPResult> {
  const sendKey = `${OTP_SEND_PREFIX}${email}`;

  const outcome = await prisma.$transaction(
    async (tx): Promise<SendOTPResult | { code: string; isNew: boolean; sendToken: string }> => {
      // One send per address at a time. A request that finds the lock taken
      // overlaps a send that is mailing the code now, so it reports 'recent'.
      if (!(await tryAdvisoryLock(tx, sendKey))) return { status: 'recent' };
      const now = Date.now();

      const live = await tx.verificationToken.findFirst({
        where: { identifier: email, expires: { gt: new Date(now) } },
      });
      if (live && live.expires.getTime() - OTP_TTL_MS + OTP_RESEND_COOLDOWN_MS > now) {
        return { status: 'recent' };
      }

      await tx.verificationToken.deleteMany({ where: { identifier: sendKey, expires: { lt: new Date(now) } } });
      const sends = await tx.verificationToken.count({ where: { identifier: sendKey } });
      if (sends >= OTP_SEND_MAX) {
        const oldest = await tx.verificationToken.findFirst({
          where: { identifier: sendKey },
          orderBy: { expires: 'asc' },
        });
        const retryAt = oldest?.expires.getTime() ?? now + OTP_SEND_WINDOW_MS;
        return { status: 'limited', retryAfterSeconds: Math.max(1, Math.ceil((retryAt - now) / 1000)) };
      }

      const sendToken = randomUUID();
      await tx.verificationToken.create({
        data: { identifier: sendKey, token: sendToken, expires: new Date(now + OTP_SEND_WINDOW_MS) },
      });

      if (live) {
        // updateMany does not throw if a verification consumed the code meanwhile.
        await tx.verificationToken.updateMany({
          where: { identifier: email, token: live.token },
          data: { expires: new Date(now + OTP_TTL_MS) },
        });
        return { code: live.token, isNew: false, sendToken };
      }

      // Only one code may be valid at a time. This also removes expired codes.
      await tx.verificationToken.deleteMany({ where: { identifier: email } });
      const code = generate6DigitCode();
      await tx.verificationToken.create({
        data: { identifier: email, token: code, expires: new Date(now + OTP_TTL_MS) },
      });
      return { code, isNew: true, sendToken };
    },
  );

  if (!('code' in outcome)) return outcome;
  try {
    await deliverCode(email, outcome.code);
  } catch (error) {
    // A mail that failed must not use up the cap, and a new code that never
    // reached the user must not hold the resend cooldown.
    await prisma.verificationToken.deleteMany({ where: { identifier: sendKey, token: outcome.sendToken } });
    if (outcome.isNew) {
      await prisma.verificationToken.deleteMany({ where: { identifier: email, token: outcome.code } });
    }
    throw error;
  }

  // Without this sweep, rows for addresses that never come back stay forever.
  await prisma.verificationToken.deleteMany({
    where: { expires: { lt: new Date(Date.now() - OTP_SWEEP_AGE_MS) } },
  });
  return { status: 'sent' };
}

async function deliverCode(email: string, code: string) {
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
