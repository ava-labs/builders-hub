import { NextAuthOptions, DefaultSession, Session, User } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GithubProvider from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '../../prisma/prisma';
import { encode, JWT } from 'next-auth/jwt';
import { randomInt, randomUUID } from 'crypto';
import type { VerifyOTPResult } from '@/types/verifyOTPResult';
import { upsertUser } from '@/server/services/auth';
import { badgeAssignmentService } from '@/server/services/badgeAssignmentService';
import { BadgeCategory } from '@/server/services/badge';
import type { User as PrismaUser } from '@prisma/client';
import { normalizeEmail } from '@/lib/utils';
import { tryAdvisoryLock } from '@/lib/db/advisoryLock';


declare module 'next-auth' {
  export interface Session {
    jwt_token?: string;
    user: {
      id: string;
      avatar?: string;
      custom_attributes: string[];
      role?: string;
      email?: string;
      user_name?: string;
      is_new_user: boolean;
      authentication_mode?: string;
      team_id?: string | null;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    avatar?: string | null;
    custom_attributes: string[];
    authentication_mode?: string;
    is_new_user?: boolean;
    user_name?: string;
    team_id?: string | null;
  }
}

/**
 * Wrong codes allowed per email. A code has 900,000 values, so without a cap a
 * script can try them all within one code's 3-minute life. These caps hold a
 * guesser to 20 tries a day, whichever code is live and however many are sent.
 */
const OTP_ATTEMPT_LIMITS = [
  { windowMs: 15 * 60 * 1000, max: 5 },
  { windowMs: 24 * 60 * 60 * 1000, max: 20 },
];
const OTP_ATTEMPT_TTL_MS = Math.max(...OTP_ATTEMPT_LIMITS.map((limit) => limit.windowMs));

/**
 * A failed attempt is a VerificationToken row under this prefix, so the cap
 * needs no schema change. The prefix contains ':', which a valid email cannot
 * hold, so the rows never collide with a live code's identifier.
 */
export const OTP_ATTEMPT_PREFIX = 'otp-attempt:';

export async function verifyOTP(
  email: string,
  code: string
): Promise<VerifyOTPResult> {
  const attemptKey = `${OTP_ATTEMPT_PREFIX}${email}`;

  return prisma.$transaction(async (tx) => {
    // One verification per email at a time, so parallel guesses cannot all
    // read the same failure count. A request that finds the lock taken is
    // refused without a check: it must not wait (see tryAdvisoryLock), and a
    // guess that is not checked needs no count.
    if (!(await tryAdvisoryLock(tx, attemptKey))) {
      return { isValid: false, reason: 'BUSY' };
    }
    const now = Date.now();

    await tx.verificationToken.deleteMany({
      where: { identifier: attemptKey, expires: { lt: new Date(now) } },
    });
    for (const { windowMs, max } of OTP_ATTEMPT_LIMITS) {
      // Each row expires OTP_ATTEMPT_TTL_MS after its failure, so a row whose
      // expiry is later than this bound failed within the window.
      const failures = await tx.verificationToken.count({
        where: {
          identifier: attemptKey,
          expires: { gt: new Date(now + OTP_ATTEMPT_TTL_MS - windowMs) },
        },
      });
      if (failures >= max) {
        // Burn the live code so that no later guess can reach it.
        await tx.verificationToken.deleteMany({ where: { identifier: email } });
        return { isValid: false, reason: 'TOO_MANY_ATTEMPTS' };
      }
    }

    const record = await tx.verificationToken.findFirst({
      where: { identifier: email, token: code },
    });

    if (record == null || record.token !== code) {
      // Count a wrong guess only while a code is live. A guess with no live
      // code cannot succeed, and counting it would let anyone lock an address
      // out without the owner getting any mail.
      const live = await tx.verificationToken.count({
        where: { identifier: email, expires: { gt: new Date(now) } },
      });
      if (live > 0) {
        await tx.verificationToken.create({
          data: {
            identifier: attemptKey,
            token: randomUUID(),
            expires: new Date(now + OTP_ATTEMPT_TTL_MS),
          },
        });
      }
      return { isValid: false, reason: 'NOT_FOUND' };
    }
    if (record.expires < new Date(now)) {
      await tx.verificationToken.delete({
        where: { identifier_token: { identifier: email, token: record.token } },
      });
      return { isValid: false, reason: 'EXPIRED' };
    }

    await tx.verificationToken.delete({
      where: { identifier_token: { identifier: email, token: record.token } },
    });
    await tx.verificationToken.deleteMany({ where: { identifier: attemptKey } });
    return { isValid: true };
  });
}

/**
 * Generates a cryptographically secure 6-digit code (100000-999999).
 *
 * Uses `crypto.randomInt` instead of `Math.random`, which is not suitable for
 * security-sensitive values such as OTPs / verification codes.
 */
export function generate6DigitCode(): string {
  return randomInt(100000, 1000000).toString();
}

const authUserSelect = {
  id: true,
  email: true,
  image: true,
  name: true,
  custom_attributes: true,
  authentication_mode: true,
  notifications: true,
  user_name: true,
  team_id: true,
} as const;

export const AuthOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
    GithubProvider({
      clientId: process.env.GITHUB_ID as string,
      clientSecret: process.env.GITHUB_SECRET as string,
    }),
    CredentialsProvider({
      credentials: {
        email: { label: 'Email', type: 'email' },
        otp: { label: 'OTP', type: 'text' },
      },
      async authorize(credentials) {
        const { email, otp } = credentials ?? {};

        if (!email) throw new Error('Missing email');
        if (!otp) throw new Error('Missing otp');
        // A JSON body can carry any value here. Only a 6-digit string may reach
        // the token lookup, where an object would act as a Prisma filter.
        if (typeof email !== 'string' || typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
          throw new Error('INVALID');
        }

        const normalizedEmail = normalizeEmail(email);
        let result: VerifyOTPResult;
        try {
          result = await verifyOTP(normalizedEmail, otp);
        } catch (error) {
          // The message reaches the browser, so keep database errors out of it.
          console.error('[authorize] verifyOTP failed:', error);
          throw new Error('Error verifying OTP Code');
        }

        if (!result.isValid) {
          if (result.reason === 'EXPIRED') {
            throw new Error('EXPIRED');
          } else if (result.reason === 'TOO_MANY_ATTEMPTS') {
            throw new Error('TOO_MANY_ATTEMPTS');
          } else if (
            result.reason === 'NOT_FOUND' ||
            result.reason === 'INVALID'
          ) {
            throw new Error('INVALID');
          } else {
            throw new Error('Error verifying OTP Code');
          }
        }

        let user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          select: authUserSelect,
        });
        if (!user) {
          user = {
            email: normalizedEmail, notification_email: normalizedEmail, name: '', image: '', last_login: new Date(), authentication_mode: '', bio: '',
            custom_attributes: [], id: '', integration: '', notifications: null, profile_privacy: null,
            additional_social_accounts: [], telegram_account: '', github_account: null, x_account: null, linkedin_account: null,
            user_name: '', created_at: new Date(),
            country: null, user_type: null, wallet: [], skills: [], team_id: null, noun_avatar_seed: null, noun_avatar_enabled: false,
            github_access_token: null,
          } as unknown as PrismaUser;
        }

        return user;
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        // For OTP (credentials) login, don't create the user yet if they're new
        // The user will be created after they accept terms
        if (account?.provider === 'credentials') {
          // Check if user already exists in the database
          const existingUser = await prisma.user.findUnique({
            where: { email: normalizeEmail(user.email!) },
            select: { id: true },
          });

          if (existingUser) {
            // Existing user - update last_login and set the user id
            user.id = existingUser.id;
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { last_login: new Date() },
              select: { id: true },
            });
          }
          // If user doesn't exist, don't create them yet
          // They will be created after accepting terms
          // The session will have is_new_user: true but no DB record
          return true;
        }

        // For OAuth providers (Google, GitHub, Twitter), create/update user immediately
        const dbUser = await upsertUser(user, account, profile);
        user.id = dbUser.id;

        if (account?.provider == 'github') {
          await badgeAssignmentService.assignBadge({
            userId: dbUser.id,
            requirementId: 'GitHub',
            category: BadgeCategory.requirement,
          });
        }

        return true;
      } catch (error) {
        console.error('Error processing user:', error);
        return false;
      }
    },
    async jwt({ token, user }: { token: JWT; user?: User }): Promise<JWT> {
      const rawEmail = user?.email ?? token?.email;
      const email = rawEmail ? normalizeEmail(rawEmail) : rawEmail;
      const dbUser = email
        ? await prisma.user.findUnique({
            where: { email },
            select: authUserSelect,
          })
        : null;

      if (dbUser) {
        token.id = dbUser.id;
        token.avatar = dbUser.image || token.avatar || user?.image || null;
        token.custom_attributes = dbUser.custom_attributes
        token.name = dbUser.name ?? '';
        token.email = dbUser.email ?? '';
        token.user_name = dbUser.user_name ?? '';
        token.is_new_user = dbUser.notifications == null ? true : false;
        token.authentication_mode = dbUser.authentication_mode ?? '';
        token.team_id = dbUser.team_id ?? null;
      } else if (email) {
        // New user who hasn't accepted terms yet - no DB record exists
        // Mark as pending_user so the frontend knows to show terms modal
        token.email = email;
        token.name = user?.name ?? token.name ?? '';
        token.is_new_user = true;
        token.custom_attributes = [];
        // Use a special marker for pending users (no real DB id yet)
        token.id = `pending_${token.email}`;
      }

      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (!session.user) {
        session.user = { name: '', email: '', image: '', id: '', custom_attributes: [], is_new_user: true };
      }
      session.user.id = token.id as string;
      session.user.avatar = token.avatar as string;
      session.user.custom_attributes = token.custom_attributes as string[];
      session.user.image = token.avatar as string;
      session.user.name = token.name ?? '';
      session.user.email = token.email ?? '';
      session.user.is_new_user = !!token.is_new_user;
      session.user.authentication_mode = token.authentication_mode ?? '';
      session.user.team_id = (token.team_id as string | null) ?? null;
      return {...session, jwt_token: await encode({secret: process.env.NEXTAUTH_SECRET ?? '', token: token })}
    },
    async redirect({ url, baseUrl }) {
      // If the URL is relative, convert it to absolute
      if (url.startsWith("/")) return `${baseUrl}${url}`
      // If the URL is from the same domain, allow the redirection
      if (new URL(url).origin === baseUrl) return url
      // By default, redirect to the main page
      return baseUrl
    },


  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/login',
  },
};
