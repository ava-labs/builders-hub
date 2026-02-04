import { NextAuthOptions, DefaultSession, Session, User } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GithubProvider from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';
import TwitterProvider from 'next-auth/providers/twitter';
import { prisma } from '../../prisma/prisma';
import { encode, JWT } from 'next-auth/jwt';
import type { VerifyOTPResult } from '@/types/verifyOTPResult';
import { upsertUser } from '@/server/services/auth';
import { badgeAssignmentService } from '@/server/services/badgeAssignmentService';
import { BadgeCategory } from '@/server/services/badge';


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
  }
}

async function verifyOTP(
  email: string,
  code: string
): Promise<VerifyOTPResult> {
  const record = await prisma.verificationToken.findFirst({
    where: { identifier: email, token: code },
  });

  if (record == null) {
    return { isValid: false, reason: 'NOT_FOUND' };
  }
  if (record.expires < new Date()) {
    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier: email, token: record.token } },
    });
    return { isValid: false, reason: 'EXPIRED' };
  }

  if (record.token !== code) {
    return { isValid: false, reason: 'INVALID' };
  }
  await prisma.verificationToken.delete({
    where: { identifier_token: { identifier: email, token: record.token } },
  });
  return { isValid: true };
}

export function generate6DigitCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

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
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID as string,
      clientSecret: process.env.TWITTER_CLIENT_SECRET as string,
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

        const result = await verifyOTP(email, otp);

        if (!result.isValid) {
          if (result.reason === 'EXPIRED') {
            throw new Error('EXPIRED');
          } else if (
            result.reason === 'NOT_FOUND' ||
            result.reason === 'INVALID'
          ) {
            throw new Error('INVALID');
          } else {
            throw new Error('Error verifying OTP Code');
          }
        }

        let user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          // user = await prisma.user.create({
          //   data: {
          //     email, notification_email: email, name: '', image: '', last_login: null
          //   },
          // }
          user = {
            email, notification_email: email, name: '', image: '', last_login: new Date(), authentication_mode: '', bio: '',
            custom_attributes: [], id: '', integration: '', notifications: null, profile_privacy: null, social_media: [], telegram_user: '', user_name: '', created_at: new Date(),
            country: null, user_type: null, github: null, wallet: [], skills: [], noun_avatar_seed: null, noun_avatar_enabled: false, settings: []
          } as any
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
            where: { email: user.email! },
          });

          if (existingUser) {
            // Existing user - update last_login and set the user id
            user.id = existingUser.id;
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { last_login: new Date() },
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
      let dbUser = null;

      if (user?.email) {
        dbUser = await prisma.user.findUnique({
          where: { email: user.email },
        });
      } else if (token?.email) {
        dbUser = await prisma.user.findUnique({
          where: { email: token.email },
        });
      }

      if (dbUser) {
        token.id = dbUser.id;
        token.avatar = dbUser.image || token.avatar || user?.image || null;
        token.custom_attributes = dbUser.custom_attributes
        token.name = dbUser.name ?? '';
        token.email = dbUser.email ?? '';
        token.user_name = dbUser.user_name ?? '';
        token.is_new_user = dbUser.notifications == null ? true : false;
        token.authentication_mode = dbUser.authentication_mode ?? '';
      } else if (user?.email || token?.email) {
        // New user who hasn't accepted terms yet - no DB record exists
        // Mark as pending_user so the frontend knows to show terms modal
        token.email = user?.email || token.email;
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
