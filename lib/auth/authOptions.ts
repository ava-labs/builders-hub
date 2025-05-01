import { NextAuthOptions, DefaultSession, Session, User } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import GithubProvider from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';
import TwitterProvider from 'next-auth/providers/twitter';
import { prisma } from '../../prisma/prisma';
import { JWT } from 'next-auth/jwt';
import type { VerifyOTPResult } from '@/types/verifyOTPResult';
import { upsertUser } from '@/server/services/auth';

declare module 'next-auth' {
  export interface Session {
    user: {
      id: string;
      avatar?: string;
      custom_attributes: string[]
      role?: string;
      email?: string;
      user_name?: string;
      is_new_user: boolean
    } & DefaultSession['user'];
  }
  interface JWT {
    id?: string;
    avatar?: string;
    custom_attributes: string[]
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
            email, notification_email: email, name: email, image: '', last_login: null, authentication_mode: '', bio: '',
            custom_attributes: [], id: '', integration: '', notifications: true, profile_privacy: null, social_media: [], telegram_user: '', user_name: ''
          }
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
        const dbUser = await upsertUser(user, account, profile);
        user.id = dbUser.id;
        return true;
      } catch (error) {
        console.error('Error procesing user:', error);
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
        token.is_new_user = dbUser.last_login == null
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
      session.user.is_new_user = token.is_new_user ? true : false;
      return session;
    },


  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/login',
  },
};
