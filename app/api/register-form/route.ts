import { createRegisterForm, getRegisterForm } from "@/server/services/registerForms";
import { NextRequest, NextResponse } from "next/server";
import { Session } from "next-auth";
import { withAuth } from "@/lib/protectedRoute";
import { prisma } from "@/prisma/prisma";
import { syncUserDataToHubSpot } from "@/server/services/hubspotUserData";
import { isTeam1Event } from "@/lib/events/team1";

type UserConsentsInput = {
  notifications?: unknown;
  consent_sharing?: unknown;
};

async function persistUserConsents(email: string, input: UserConsentsInput) {
  const update: { notifications?: boolean; consent_sharing?: boolean } = {};
  if (typeof input.notifications === "boolean") update.notifications = input.notifications;
  if (typeof input.consent_sharing === "boolean") update.consent_sharing = input.consent_sharing;
  if (Object.keys(update).length === 0) return;
  try {
    await prisma.user.update({ where: { email }, data: update });
  } catch (err) {
    // Don't block registration on consent persistence failure.
    console.error("[Consent] Failed to update user consents during registration:", err);
    return;
  }
  try {
    await syncUserDataToHubSpot({
      email,
      notifications: update.notifications,
      consent_sharing: update.consent_sharing,
    });
  } catch (err) {
    console.error("[HubSpot] Failed to sync updated consents during registration:", err);
  }
}

export const POST = withAuth(async (
  req: NextRequest,
  _context: unknown,
  session: Session,
) => {
  try {
    const body = await req.json();
    const { user_consents, ...registerData } = body ?? {};

    const hackathonId = registerData?.hackathon_id;
    if (session.user?.email && typeof hackathonId === "string" && hackathonId) {
      // Sharing consent is only MANDATORY for Team1-organized / co-hosted
      // events. Non-Team1 events must not block registration when the user
      // declines — they can opt in later from their profile.
      const hackathon = await prisma.hackathon.findUnique({
        where: { id: hackathonId },
        select: { organizers: true, cohosts: true },
      });
      const requiresSharingConsent = isTeam1Event({
        organizers: hackathon?.organizers,
        cohosts: hackathon?.cohosts,
      });
      if (requiresSharingConsent) {
        const user = await prisma.user.findUnique({
          where: { email: session.user.email },
          select: { consent_sharing: true },
        });
        const userHasConsent = user?.consent_sharing === true;
        const incomingConsent =
          (user_consents as UserConsentsInput | undefined)?.consent_sharing;
        if (!userHasConsent && incomingConsent !== true) {
          return NextResponse.json(
            {
              error: {
                message:
                  "Sharing consent is required to register for this event.",
                field: "user_consent_sharing",
              },
            },
            { status: 400 },
          );
        }
      }
    }

    if (user_consents && typeof user_consents === "object" && session.user?.email) {
      await persistUserConsents(session.user.email, user_consents as UserConsentsInput);
    }
    const newHackathon = await createRegisterForm(registerData, req);

    const failedInvites = Array.isArray((newHackathon as any).failedInvites)
      ? ((newHackathon as any).failedInvites as string[])
      : [];

    return NextResponse.json(
      {
        message: 'registration form created',
        hackathon: newHackathon,
        referralAttributed: Boolean((newHackathon as any).referralAttributed),
        ...(failedInvites.length > 0
          ? {
              warning:
                'Your registration was saved, but some teammate invitations could not be sent. You can re-invite them from your project page.',
              failedInvites,
            }
          : {}),
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error POST /api/register-form:', error.message);
    const wrappedError = error as Error;
    return NextResponse.json(
      {
        error: {
          message: wrappedError.message,
          stack: wrappedError.stack,
          cause: wrappedError.cause,
          name: wrappedError.name
        }
      },
      { status: wrappedError.cause == 'ValidationError' ? 400 : 500 }
    );
  }
});

export const GET = withAuth(async (req: NextRequest, context: any, session: any) => {
  try {
    const id = req.nextUrl.searchParams.get("hackathonId");
    const email = req.nextUrl.searchParams.get("email");

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    // Verify that email matches the authenticated session user's email
    if (email !== session.user.email) {
      return NextResponse.json(
        { error: "Forbidden: You can only access your own registration forms" },
        { status: 403 }
      );
    }

    const registerFormLoaded = await getRegisterForm(email, id);

    return NextResponse.json(registerFormLoaded);
  } catch (error) {
    console.error("Error in GET /api/register-form/", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
});
