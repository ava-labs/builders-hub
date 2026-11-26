import { createRegisterForm, getRegisterForm } from "@/server/services/registerForms";
import { NextRequest, NextResponse } from "next/server";
import { Session } from "next-auth";
import { withAuth } from "@/lib/protectedRoute";
import { prisma } from "@/prisma/prisma";
import { syncUserDataToHubSpot } from "@/server/services/hubspotUserData";
import { isTeam1Event } from "@/lib/events/team1";
import { normalizeEmail } from "@/lib/utils";
import { z } from "zod";
import { readJsonBody } from "@/lib/api/json-body";
import { checkRateLimit } from "@/lib/rateLimit";
import { INVITE_RATE, MAX_EMAILS_PER_REQUEST, inviteRateKey } from "@/lib/invitations/inviteSchema";

// The fields that createRegisterForm reads. Other keys the form sends are not read, and zod drops them.
const postBodySchema = z.object({
  hackathon_id: z.string().min(1),
  email: z.string().optional(),
  // the name is in the subject of each invitation mail
  name: z.string().max(200).optional(),
  city: z.string().optional(),
  telegram_account: z.string().optional(),
  x_account: z.string().optional(),
  company_name: z.string().optional(),
  dietary: z.string().optional(),
  hackathon_participation: z.string().optional(),
  role: z.string().optional(),
  web3_proficiency: z.string().optional(),
  github_portfolio: z.string().optional(),
  interests: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  roles: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
  // each teammate gets one invitation mail, as an invitation from the project page does
  teammates: z.array(z.string().max(320)).max(MAX_EMAILS_PER_REQUEST).optional(),
  newsletter_subscription: z.boolean().optional(),
  prohibited_items: z.boolean().optional(),
  terms_event_conditions: z.boolean().optional(),
  referral_attribution: z
    .object({
      referralCode: z.string().nullish(),
      landingPath: z.string().nullish(),
      manualReferrer: z
        .object({
          teamId: z.string(),
          teamIdOther: z.string().nullish(),
          userId: z.string().nullish(),
        })
        .nullish(),
    })
    .nullish()
    // The client keeps the referral in localStorage. A stored value of the
    // wrong shape counts as no referral, so it does not stop a registration.
    .catch(null),
  user_consents: z
    .object({
      notifications: z.boolean().optional(),
      consent_sharing: z.boolean().optional(),
    })
    .optional(),
});

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
    const body = await readJsonBody(req, postBodySchema);
    if (!body) {
      return NextResponse.json({ error: { message: "Invalid request body" } }, { status: 400 });
    }
    const { user_consents, ...registerData } = body;

    const sessionEmail = session.user?.email;
    if (!sessionEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      typeof registerData.email === "string" &&
      registerData.email.trim() &&
      registerData.email.trim().toLowerCase() !== sessionEmail.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "Forbidden: You can only register with your own account" },
        { status: 403 }
      );
    }
    registerData.email = sessionEmail;

    // A registration with teammates sends invitation mail, so it counts in the account's invitation budget.
    if ((registerData.teammates ?? []).some((teammate) => teammate.trim())) {
      const limit = checkRateLimit(inviteRateKey(session.user), INVITE_RATE);
      if (!limit.allowed) {
        return NextResponse.json(
          { error: { message: "Too many invitations sent. Please try again later.", field: "teammates" } },
          { status: 429 },
        );
      }
    }

    // Team1-organized events require explicit sharing consent unless the user
    // has already granted it on their profile. Enforce here so a crafted
    // client request can't bypass the registration form's required check.
    const hackathonId = registerData?.hackathon_id;
    if (session.user?.email && typeof hackathonId === "string" && hackathonId) {
      const [hackathon, user] = await Promise.all([
        prisma.hackathon.findUnique({
          where: { id: hackathonId },
          select: { organizers: true, cohosts: true },
        }),
        prisma.user.findUnique({
          where: { email: session.user.email },
          select: { consent_sharing: true },
        }),
      ]);
      const isTeam1 = hackathon ? isTeam1Event(hackathon) : false;
      const userHasConsent = user?.consent_sharing === true;
      const incomingConsent =
        (user_consents as UserConsentsInput | undefined)?.consent_sharing;
      if (isTeam1 && !userHasConsent && incomingConsent !== true) {
        return NextResponse.json(
          {
            error: {
              message:
                "Team1 sharing consent is required to register for this event.",
              field: "user_consent_sharing",
            },
          },
          { status: 400 },
        );
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
    console.error('Error POST /api/register-form:', error.message, error.stack);
    const wrappedError = error as Error;
    const isValidation = wrappedError.cause == 'ValidationError';
    return NextResponse.json(
      { error: { message: isValidation ? wrappedError.message : 'Internal server error' } },
      { status: isValidation ? 400 : 500 }
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

    // Verify that email matches the authenticated session user's email.
    // Session email is normalized; normalize the param so a client passing the
    // originally-typed casing doesn't get a spurious 403.
    if (normalizeEmail(email) !== session.user.email) {
      return NextResponse.json(
        { error: "Forbidden: You can only access your own registration forms" },
        { status: 403 }
      );
    }

    const registerFormLoaded = await getRegisterForm(session.user.email, id);

    return NextResponse.json(registerFormLoaded);
  } catch (error) {
    console.error("Error in GET /api/register-form/", error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
});
