import { NextRequest, NextResponse } from 'next/server';
import { Session } from 'next-auth';
import { prisma } from '@/prisma/prisma';
import { syncUserDataToHubSpot } from '@/server/services/hubspotUserData';
import { recordReferralAttributionFromRequest } from '@/server/services/referrals';

const SIGNUP_ATTRIBUTION_RETRY_WINDOW_MS = 24 * 60 * 60 * 1000;

async function recordBhSignupReferral(
  req: NextRequest,
  user: { id: string; email: string | null },
  referralAttribution: unknown,
) {
  try {
    const attribution = await recordReferralAttributionFromRequest(req, {
      targetType: 'bh_signup',
      userId: user.id,
      userEmail: user.email,
      attribution: referralAttribution as any,
    });
    return Boolean(attribution);
  } catch (error) {
    console.error('[Referral] Failed to record BH signup attribution:', error);
    return false;
  }
}
import { withAuth } from '@/lib/protectedRoute';

/**
 * API endpoint to create a new user after they accept terms.
 * This is called when a user verifies their email via OTP but hasn't been
 * created in the database yet (to avoid creating accounts for users who
 * don't accept terms).
 */
export const POST = withAuth(async (
  req: NextRequest,
  _context: unknown,
  session: Session
) => {
  try {
    const email = session.user.email;
    const body = await req.json();
    const {
      notifications = false,
      consent_sharing = false,
      referral_attribution = null,
    } = body;

    if (!email) {
      console.error('[create-after-terms] No email in session — session:', JSON.stringify({ id: session.user.id, email }));
      return NextResponse.json({ error: 'No email in session' }, { status: 400 });
    }

    // Check if user already exists (shouldn't happen, but safety check)
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, created_at: true },
    });

    if (existingUser) {
      const isRecentSignup =
        Date.now() - existingUser.created_at.getTime() <= SIGNUP_ATTRIBUTION_RETRY_WINDOW_MS;
      const referralAttributed = isRecentSignup
        ? await recordBhSignupReferral(req, existingUser, referral_attribution)
        : false;

      // User already exists, just return their data
      return NextResponse.json({
        id: existingUser.id,
        email: existingUser.email,
        alreadyExists: true,
        referralAttributed,
      });
    }

    // Create the new user
    const newUser = await prisma.user.create({
      select: { id: true, email: true, name: true, notifications: true, consent_sharing: true },
      data: {
        email: email || '',
        notification_email: email,
        name: '',
        image: '',
        authentication_mode: 'credentials',
        last_login: new Date(),
        notifications: notifications,
        consent_sharing: consent_sharing,
        custom_attributes: [],
        additional_social_accounts: [],
        wallet: [],
        skills: [],
      }
    });

    // Sync user data to HubSpot (after terms acceptance)
    if (newUser.email) {
      try {
        await syncUserDataToHubSpot({
          email: newUser.email,
          name: newUser.name || undefined,
          notifications: newUser.notifications ?? undefined,
          consent_sharing: newUser.consent_sharing ?? undefined,
          gdpr: true, // User accepted terms and conditions
        });
      } catch (error) {
        console.error('[HubSpot UserData] Failed to sync new user:', error);
        // Don't block user creation if HubSpot sync fails
      }
    }

    const referralAttributed = await recordBhSignupReferral(req, newUser, referral_attribution);

    return NextResponse.json({
      id: newUser.id,
      email: newUser.email,
      created: true,
      referralAttributed,
    });
  } catch (error: any) {
    console.error('[create-after-terms] Failed — code:', error?.code, '| message:', error?.message, '| meta:', JSON.stringify(error?.meta));
    return NextResponse.json(
      { error: 'Failed to create user', code: error?.code },
      { status: 500 }
    );
  }
});
