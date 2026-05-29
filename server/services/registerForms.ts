import {
  hasAtLeastOne,
  requiredField,
  validateEntity,
  Validation,
} from "./base";
import { revalidatePath } from "next/cache";
import { ValidationError } from "./hackathons";
import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/prisma/prisma";
import { RegistrationForm } from "@/types/registrationForm";
import { sendMail } from "./mail";
import { recordReferralAttributionFromRequest } from "./referrals";
import { normalizeEventsLang, t } from "@/lib/events/i18n";
import { isHubSpotEnabled, skipHubSpot } from "./hubspot";
import { COUNTRY_LOCKED_MESSAGE, isCountryChange } from "@/lib/profile/countryLock";
import { getTeamSizeRange } from "@/lib/hackathons/teamSizeDefaults";
import { isCountryAllowed } from "@/lib/hackathons/countryTargetDefaults";
import { generateInvitation } from "./inviteProjectMember";

export const registerValidations: Validation[] = [
  {
    field: "name",
    message: "Name is required.",
    validation: (registerForm: RegistrationForm) =>
      requiredField(registerForm, "name"),
  },
  {
    field: "email",
    message: "A valid email is required.",
    validation: (registerForm: RegistrationForm) =>
      requiredField(registerForm, "email") &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registerForm.email || ""),
  },
  {
    field: "city",
    message: "City is required.",
    validation: (registerForm: RegistrationForm) =>
      requiredField(registerForm, "city"),
  },
  {
    field: "telegram_account",
    message: "Telegram username is required.",
    validation: (registerForm: RegistrationForm) =>
      requiredField(registerForm, "telegram_account"),
  },
  // Note: The following fields are now optional in Step 2
  // {
  //   field: "interests",
  //   message: "Please select at least one interest.",
  //   validation: (registerForm: RegistrationForm) =>
  //     hasAtLeastOne(registerForm, "interests"),
  // },
  // {
  //   field: "web3_proficiency",
  //   message: "Web3 proficiency is required.",
  //   validation: (registerForm: RegistrationForm) =>
  //     requiredField(registerForm, "web3_proficiency"),
  // },
  // {
  //   field: "tools",
  //   message: "Please select at least one tool.",
  //   validation: (registerForm: RegistrationForm) =>
  //     hasAtLeastOne(registerForm, "tools"),
  // },
  // {
  //   field: "roles",
  //   message: "Please select at least one role.",
  //   validation: (registerForm: RegistrationForm) =>
  //     hasAtLeastOne(registerForm, "roles"),
  // },
  // {
  //   field: "languages",
  //   message: "Please select at least one programming language.",
  //   validation: (registerForm: RegistrationForm) =>
  //     hasAtLeastOne(registerForm, "languages"),
  // },
  // {
  //   field: "hackathon_participation",
  //   message: "Hackathon participation is required.",
  //   validation: (registerForm: RegistrationForm) =>
  //     requiredField(registerForm, "hackathon_participation"),
  // },
  {
    field: "terms_event_conditions",
    message: "You must accept the Event Terms and Conditions to continue.",
    validation: (registerForm: RegistrationForm) =>
      registerForm.terms_event_conditions === true,
  },
  {
    field: "prohibited_items",
    message: "You must agree not to bring prohibited items to continue.",
    validation: (registerForm: RegistrationForm) =>
      registerForm.prohibited_items === true,
  },
];

export const createRegisterValidations = (
  isOnlineHackathon: boolean,
  isSimpleMode: boolean = false
): Validation[] => {
  const baseValidations = registerValidations.filter(validation => validation.field !== "prohibited_items");

  // Simple-mode registrations intentionally omit the prohibited-items consent
  // (the form only renders the T&C checkbox), so don't require it server-side.
  // Online hackathons never require it either.
  if (!isOnlineHackathon && !isSimpleMode) {
    baseValidations.push({
      field: "prohibited_items",
      message: "You must agree not to bring prohibited items to continue.",
      validation: (registerForm: RegistrationForm) =>
        registerForm.prohibited_items === true,
    });
  }

  return baseValidations;
};

export const validateRegisterForm = (
  registerData: Partial<RegistrationForm>,
  isOnlineHackathon: boolean = false,
  isSimpleMode: boolean = false
): Validation[] => validateEntity(createRegisterValidations(isOnlineHackathon, isSimpleMode), registerData);
export async function createRegisterForm(
  registerData: Partial<RegistrationForm> & {
    x_account?: string;
    teammates?: string[];
  },
  request?: Request
): Promise<RegistrationForm> {
  // Get hackathon information to determine if it's online
  const hackathon = await prisma.hackathon.findUnique({
    where: { id: registerData.hackathon_id },
  });

  const isOnlineHackathon = hackathon?.location?.toLowerCase().includes("online") || false;
  // Simple-mode events render a single page with only the T&C checkbox and
  // intentionally omit the prohibited-items consent; mirror that here so the
  // server doesn't require a field the form never collects.
  const isSimpleMode = (hackathon?.content as any)?.registration_mode === "simple";
  // Teammate invitations are handled separately (Member rows + invitation
  // emails). Keep them out of the RegisterForm payload itself.
  const rawTeammates = Array.isArray(registerData.teammates) ? registerData.teammates : [];

  // Telegram is mandatory on the User profile (BasicProfileSetup gate),
  // so the registration form no longer asks for it. Pull it from the user
  // record here so the validation, upsert, and HubSpot payload all see it.
  // newsletter_subscription is treated as a per-event snapshot of the
  // canonical User.notifications value; mirror it here so the column reflects
  // the user's current marketing consent even when the grouped block in
  // Step 3 was hidden (because notifications was already true on the User).
  let existingUser: {
    id: string;
    telegram_account: string | null;
    notifications: boolean | null;
    country: string | null;
    x_account: string | null;
  } | null = null;
  if (registerData.email) {
    existingUser = await prisma.user.findUnique({
      where: { email: registerData.email },
      select: {
        id: true,
        telegram_account: true,
        notifications: true,
        country: true,
        x_account: true,
      },
    });
    if (existingUser?.telegram_account) {
      registerData.telegram_account = existingUser.telegram_account;
    }
    if (existingUser && typeof existingUser.notifications === "boolean") {
      registerData.newsletter_subscription = existingUser.notifications;
    }
  }

  // Country target gate: when the hackathon restricts to specific countries,
  // refuse registrants whose stored country (or the country they're trying
  // to register with) isn't in the whitelist. Empty/missing list = global.
  const targetCountries = (hackathon?.content as any)?.target_countries as
    | string[]
    | undefined;
  if (Array.isArray(targetCountries) && targetCountries.length > 0) {
    const candidateCountry = existingUser?.country?.trim() || registerData.city?.trim();
    if (!isCountryAllowed(targetCountries, candidateCountry)) {
      throw new ValidationError(
        `This event is restricted to participants from: ${targetCountries.join(", ")}.`,
        [
          {
            field: "city",
            message: `This event is restricted to participants from: ${targetCountries.join(", ")}.`,
            validation: () => false,
          },
        ],
      );
    }
  }

  if (existingUser?.country) {
    if (isCountryChange(existingUser.country, registerData.city)) {
      throw new ValidationError(COUNTRY_LOCKED_MESSAGE, [
        {
          field: "city",
          message: COUNTRY_LOCKED_MESSAGE,
          validation: () => false,
        },
      ]);
    }
    registerData.city = existingUser.country;
  }

  if (existingUser && typeof registerData.x_account === "string") {
    const trimmed = registerData.x_account.trim();
    if (trimmed.length > 0 && trimmed !== existingUser.x_account) {
      try {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { x_account: trimmed },
        });
      } catch (err) {
        console.error("[Registration] Failed to persist x_account:", err);
      }
    }
  }

  const errors = validateRegisterForm(registerData, isOnlineHackathon, isSimpleMode);
  if (errors.length > 0) {
    throw new ValidationError("Validation failed", errors);
  }

  // Enforce the admin-configured team-size range, normalize teammate emails,
  // and reject the registrant inviting themselves or duplicates.
  const teamRange = getTeamSizeRange({
    team_size_min: (hackathon?.content as any)?.team_size_min,
    team_size_max: (hackathon?.content as any)?.team_size_max,
  });
  const inviterEmail = (registerData.email ?? "").trim().toLowerCase();
  const teammateEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const dedupedTeammates: string[] = [];
  const invalidTeammates: string[] = [];
  for (const raw of rawTeammates) {
    if (typeof raw !== "string") continue;
    const e = raw.trim().toLowerCase();
    if (!e) continue;
    // Reject malformed addresses server-side (the client validates too, but a
    // crafted request must not slip an unsendable email into the invite flow).
    if (!teammateEmailPattern.test(e)) {
      invalidTeammates.push(e);
      continue;
    }
    if (e === inviterEmail) continue;
    if (dedupedTeammates.includes(e)) continue;
    dedupedTeammates.push(e);
  }
  if (invalidTeammates.length > 0) {
    throw new ValidationError("Validation failed", [
      {
        field: "teammates",
        message: `These teammate emails are not valid: ${invalidTeammates.join(", ")}.`,
        validation: () => false,
      },
    ]);
  }
  const teamSize = 1 + dedupedTeammates.length;
  if (teamSize < teamRange.min) {
    throw new ValidationError("Validation failed", [
      {
        field: "teammates",
        message: `This event requires a team of at least ${teamRange.min}.`,
        validation: () => false,
      },
    ]);
  }
  if (teamRange.max !== undefined && teamSize > teamRange.max) {
    throw new ValidationError("Validation failed", [
      {
        field: "teammates",
        message: `Team size cannot exceed ${teamRange.max} for this event.`,
        validation: () => false,
      },
    ]);
  }

  const isNewRegistration = !(await prisma.registerForm.findUnique({
    where: {
      hackathon_id_email: {
        hackathon_id: registerData.hackathon_id as string,
        email: registerData.email as string,
      },
    },
    select: { id: true },
  }));

  const content = { ...registerData } as Prisma.JsonObject;
  const commonFields = {
    city: registerData.city ?? "",
    telegram_account: registerData.telegram_account ?? "",
    company_name: registerData.company_name ?? null,
    dietary: registerData.dietary ?? null,
    hackathon_participation: registerData.hackathon_participation ?? "",
    interests: (registerData.interests ?? []).join(","),
    languages: (registerData.languages ?? []).join(","),
    roles: (registerData.roles ?? []).join(","),
    name: registerData.name ?? "",
    newsletter_subscription: registerData.newsletter_subscription ?? false,
    prohibited_items: registerData.prohibited_items ?? false,
    role: registerData.role ?? "",
    terms_event_conditions: registerData.terms_event_conditions ?? false,
    tools: (registerData.tools ?? []).join(","),
    web3_proficiency: registerData.web3_proficiency ?? "",
    github_portfolio: registerData.github_portfolio ?? "",
  };
  const newRegisterFormData = await prisma.registerForm.upsert({
    where: {
      hackathon_id_email: {
        hackathon_id: registerData.hackathon_id as string,
        email: registerData.email as string,
      },
    },
    update: commonFields,
    create: {
      ...commonFields,
      hackathon: {
        connect: { id: registerData.hackathon_id },
      },
      user: {
        connect: { email: registerData.email },
      },
    },
  });
  registerData.id = newRegisterFormData.id;

  let referralAttributed = false;
  try {
    // Merge the client-supplied attribution with the `ref` cookie so a referral
    // code still lands even when the form payload omits it (e.g. the code only
    // ever lived in storage/cookie and not in the submitted URL).
    const attribution = await recordReferralAttributionFromRequest(
      request ?? new Request("https://build.avax.network"),
      {
        targetType: "hackathon_registration",
        targetId: newRegisterFormData.hackathon_id,
        userEmail: newRegisterFormData.email,
        attribution: (registerData as any).referral_attribution ?? null,
      }
    );
    referralAttributed = Boolean(attribution);
  } catch (error) {
    console.error("[Referral] Failed to record hackathon registration attribution:", error);
  }

  // Send registration data to HubSpot
  try {
    await sendRegistrationToHubSpot(newRegisterFormData, hackathon);
  } catch (error) {
    console.error('Failed to send registration to HubSpot:', error);
    // Continue with registration even if HubSpot fails
  }
  
  if (isNewRegistration) {
    await sendConfirmationMail(
      newRegisterFormData.email,
      newRegisterFormData.hackathon_id as string
    );
  }

  // Team invitations: reuse the project-member invite flow so teammate
  // Members land in "Pending Confirmation" with the existing email + sign-in
  // confirmation mechanic. The shared helper auto-creates the stub Project
  // for this (hackathon, user) and is idempotent across re-registrations.
  //
  // We don't block registration on an invite failure (the registrant is
  // already saved), but we must NOT swallow it silently either: any teammate
  // whose invite didn't send is returned in `failedInvites` so the route can
  // warn the user instead of leaving a min-team event with missing members.
  let failedInvites: string[] = [];
  if (dedupedTeammates.length > 0 && existingUser?.id) {
    const lang = normalizeEventsLang((hackathon?.content as any)?.language);
    try {
      const inviteResult = await generateInvitation(
        newRegisterFormData.hackathon_id as string,
        existingUser.id,
        newRegisterFormData.name ?? existingUser.id,
        dedupedTeammates,
        undefined,
        undefined,
        lang,
      );
      // generateInvitation skips self-invites / already-confirmed members
      // (those never appear in InviteLinks), so only treat links it actually
      // attempted and reported as failed.
      failedInvites = (inviteResult.InviteLinks ?? [])
        .filter((link) => !link.Success)
        .map((link) => link.User);
    } catch (err) {
      // The whole batch failed before any send completed — surface every
      // teammate so the user knows none of the invites went out.
      console.error("[Registration] Failed to send teammate invitations:", err);
      failedInvites = [...dedupedTeammates];
    }
    if (failedInvites.length > 0) {
      console.error(
        "[Registration] Some teammate invitations did not send:",
        failedInvites,
      );
    }
  }

  revalidatePath("/api/register-form/");

  return {
    ...newRegisterFormData,
    referralAttributed,
    failedInvites,
  } as unknown as RegistrationForm & {
    referralAttributed: boolean;
    failedInvites: string[];
  };
}
export async function getRegisterForm(email: string, hackathon_id: string) {
  const [registeredData, attribution] = await Promise.all([
    prisma.registerForm.findFirst({
      where: { user: { email }, hackathon_id },
    }),
    prisma.referralAttribution.findFirst({
      where: {
        target_type: "hackathon_registration",
        target_id: hackathon_id,
        user: { email },
      },
      select: {
        team_id_referrer: true,
        team_id_referrer_other: true,
        user_id_referrer: true,
      },
    }),
  ]);

  if (!registeredData) return null;
  return { ...registeredData, referralAttribution: attribution ?? null };
}
export async function sendConfirmationMail(
  email: string,
  hackathon_id: string
) {
  const hackathon = await prisma.hackathon.findUnique({
    where: { id: hackathon_id },
  });
  const lang = normalizeEventsLang((hackathon?.content as any)?.language);
  const subject = t(lang, "reg.email.subject");
  const text = `${t(lang, "reg.email.yourRegFor")} ${hackathon?.title} ${t(lang, "reg.email.hasBeenApproved")} ${t(lang, "reg.email.chatLinkText")}.`;
  const html = `
    <div style="background-color: #18181B; color: white; font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border-radius: 8px; border: 1px solid #EF4444; text-align: center;">
      <h2 style="color: white; font-size: 20px; margin-bottom: 16px;">${t(lang, "reg.email.h2")}</h2>

      <div style="background-color: #27272A; border: 1px solid #EF4444; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <p style="font-size: 20px; font-weight: bold; color: #ffffff; margin: 8px 0;">${t(lang, "reg.email.yourRegFor")}</p>
        <p style="font-size: 20px; font-weight: bold; color: #EF4444; margin: 8px 0;">${hackathon?.title}</p>
        <p style="font-size: 20px; font-weight: bold; color: #ffffff; margin: 8px 0;">${t(lang, "reg.email.hasBeenApproved")} <a href="https://t.me/avalancheacademy" style="color: #3B82F6; text-decoration: underline;">${t(lang, "reg.email.chatLinkText")}</a>.</p>
        <p style="font-size: 10px; font-weight: bold; color: #ffffff; margin: 8px 0;">${t(lang, "reg.email.automated")}</p>
      </div>

      <p style="font-size: 12px; color: #A1A1AA;">${t(lang, "reg.email.ignore")}</p>

      <div style="margin-top: 20px;">
        <img src="https://build.avax.network/logo-white.png" alt="Company Logo" style="max-width: 120px; margin-bottom: 10px;">
        <p style="font-size: 12px; color: #A1A1AA;">${t(lang, "reg.email.footer")}</p>
      </div>
    </div>
    `;
  try {
    await sendMail(email, html, subject, text);
  } catch (error) {
    console.error("Error sending confirmation email:", error);
  }
}

export async function sendSubmissionConfirmationMail(
  email: string,
  projectName: string,
  hackathonId: string,
) {
  const hackathon = await prisma.hackathon.findUnique({
    where: { id: hackathonId },
    select: { title: true, content: true },
  });
  const lang = normalizeEventsLang((hackathon?.content as any)?.language);
  const subject = t(lang, "submission.email.subject", { projectName });
  const text = `${t(lang, "submission.email.congrats")} ${t(lang, "submission.email.body")} "${projectName}" ${t(lang, "submission.email.body2")} ${hackathon?.title}. ${t(lang, "submission.email.body3")}`;
  const html = `
    <div style="background-color: #18181B; color: white; font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border-radius: 8px; border: 1px solid #EF4444; text-align: center;">
      <h2 style="color: white; font-size: 20px; margin-bottom: 16px;">${t(lang, "submission.email.h2")}</h2>

      <div style="background-color: #27272A; border: 1px solid #EF4444; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <p style="font-size: 22px; font-weight: bold; color: #EF4444; margin: 8px 0;">${t(lang, "submission.email.congrats")}</p>
        <p style="font-size: 16px; color: #ffffff; margin: 8px 0;">
          ${t(lang, "submission.email.body")} <strong style="color: #EF4444;">${projectName}</strong> ${t(lang, "submission.email.body2")} <strong>${hackathon?.title ?? ""}</strong>.
        </p>
        <p style="font-size: 14px; color: #A1A1AA; margin: 12px 0;">${t(lang, "submission.email.body3")}</p>
        <p style="font-size: 10px; font-weight: bold; color: #A1A1AA; margin: 8px 0;">${t(lang, "submission.email.automated")}</p>
      </div>

      <p style="font-size: 12px; color: #A1A1AA;">${t(lang, "submission.email.ignore")}</p>

      <div style="margin-top: 20px;">
        <img src="https://build.avax.network/logo-white.png" alt="Company Logo" style="max-width: 120px; margin-bottom: 10px;">
        <p style="font-size: 12px; color: #A1A1AA;">${t(lang, "submission.email.footer")}</p>
      </div>
    </div>
  `;
  try {
    await sendMail(email, html, subject, text);
  } catch (error) {
    console.error("Error sending submission confirmation email:", error);
  }
}

// Function to send registration data to HubSpot
export async function sendRegistrationToHubSpot(
  registrationData: any,
  hackathon: any
): Promise<void> {
  if (!isHubSpotEnabled()) {
    skipHubSpot(`sendRegistrationToHubSpot(${registrationData?.email ?? "unknown"})`);
    return;
  }
  const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
  const HUBSPOT_PORTAL_ID = process.env.HUBSPOT_PORTAL_ID;
  const HUBSPOT_HACKATHON_FORM_GUID = process.env.HUBSPOT_HACKATHON_FORM_GUID;

  if (!HUBSPOT_API_KEY || !HUBSPOT_PORTAL_ID || !HUBSPOT_HACKATHON_FORM_GUID) {
    console.error("[HubSpot] Missing environment variables for hackathon registration", {
      hasApiKey: Boolean(HUBSPOT_API_KEY),
      hasPortalId: Boolean(HUBSPOT_PORTAL_ID),
      hasFormGuid: Boolean(HUBSPOT_HACKATHON_FORM_GUID)
    });
    return;
  }

  try {
    // Prepare the data for HubSpot
    // Using descriptive names for HubSpot properties that you can map to your actual HubSpot field names
    const hubspotData = {
      // Standard fields (keep existing)
      email: registrationData.email,
      //firstname: registrationData.name?.split(' ')[0] || registrationData.name,
      //lastname: registrationData.name?.split(' ').slice(1).join(' ') || '',
      // Hackathon-registration-specific fields
      'fullname': registrationData.name,
      'country_dropdown': registrationData.city,
      'hs_role': registrationData.role || 'Other',
      'name': registrationData.company_name || '',
      'telegram_handle': registrationData.telegram_account || '',
      'github_url': registrationData.github_portfolio || '',
      //'avalanche_ecosystem_member': registrationData.hackathon_participation || '',
      'hackathon_interests': registrationData.interests || '',
      'programming_language_familiarity': registrationData.languages || '',
      'employment_role_other': registrationData.roles || 'Other',
      'tooling_familiarity': registrationData.tools || '',
      'founder_check': registrationData.founder_check ? 'Yes' : 'No',
      'avalanche_ecosystem_member': registrationData.avalanche_ecosystem_member ? 'Yes' : 'No',
      //'hackathon_event_id': registrationData.hackathon_id, // TODO: add this to the HS form
      //'hackathon_event_title': hackathon?.title || '', // TODO: add this to the HS form

      'marketing_consent': registrationData.newsletter_subscription ? 'Yes' : 'No',
      'gdpr': registrationData.terms_event_conditions ? 'Yes' : 'No' // TODO: add this to the HS form
    };

    // Build HubSpot payload
    const fields: { name: string; value: string | boolean }[] = [];
    Object.entries(hubspotData).forEach(([name, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      
      fields.push({
        name: name,
        value: value
      });
    });

    const hubspotPayload = {
      fields: fields,
      context: {
        pageUri: 'https://build.avax.network/events/registration-form',
        pageName: 'Hackathon Registration'
      },
      legalConsentOptions: {
        consent: {
          consentToProcess: true,
          text: "I agree to allow Avalanche Foundation to store and process my personal data for hackathon participation purposes.",
          communications: [
            {
              value: registrationData.newsletter_subscription || false,
              subscriptionTypeId: 999,
              text: "I would like to receive marketing emails from the Avalanche Foundation."
            }
          ]
        }
      }
    };

    // Submit to HubSpot

    const response = await fetch(
      `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_HACKATHON_FORM_GUID}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
          'User-Agent': 'BuildersHub/1.0 (hackathon-registration)'
        },
        body: JSON.stringify(hubspotPayload)
      }
    );

    const responseStatus = response.status;
    let responseBody: any = null;
    try {
      responseBody = await response.json();
    } catch (jsonErr) {
      try {
        responseBody = await response.text();
      } catch {
        responseBody = '<unreadable>';
      }
    }
    if (!response.ok) {
      throw new Error(`HubSpot API error: ${responseStatus} - ${typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody)}`);
    }

  } catch (error) {
    console.error('[HubSpot] Error sending registration', error);
    throw error;
  }
}
