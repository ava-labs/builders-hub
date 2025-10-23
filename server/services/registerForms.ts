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
    field: "telegram_user",
    message: "Telegram username is required.",
    validation: (registerForm: RegistrationForm) =>
      requiredField(registerForm, "telegram_user"),
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

export const createRegisterValidations = (isOnlineHackathon: boolean): Validation[] => {
  const baseValidations = registerValidations.filter(validation => validation.field !== "prohibited_items");
  
  if (!isOnlineHackathon) {
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
  isOnlineHackathon: boolean = false
): Validation[] => validateEntity(createRegisterValidations(isOnlineHackathon), registerData);
export async function createRegisterForm(
  registerData: Partial<RegistrationForm>
): Promise<RegistrationForm> {
  // Get hackathon information to determine if it's online
  const hackathon = await prisma.hackathon.findUnique({
    where: { id: registerData.hackathon_id },
  });
  
  const isOnlineHackathon = hackathon?.location?.toLowerCase().includes("online") || false;
  
  const errors = validateRegisterForm(registerData, isOnlineHackathon);
  if (errors.length > 0) {
    throw new ValidationError("Validation failed", errors);
  }

  const content = { ...registerData } as Prisma.JsonObject;
  const newRegisterFormData = await prisma.registerForm.upsert({
    where: {
      hackathon_id_email: {
        hackathon_id: registerData.hackathon_id as string,
        email: registerData.email as string,
      },
    },
    update: {
      city: registerData.city ?? "",
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
      telegram_user: registerData.telegram_user ?? "",
    },
    create: {
      hackathon: {
        connect: { id: registerData.hackathon_id },
      },
      user: {
        connect: { email: registerData.email },
      },
      utm: registerData.utm ?? "",
      city: registerData.city ?? "",
      telegram_user: registerData.telegram_user ?? "",
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
    },
  });
  registerData.id = newRegisterFormData.id;
  
  // Send registration data to HubSpot
  try {
    await sendRegistrationToHubSpot(newRegisterFormData, hackathon);
  } catch (error) {
    console.error('Failed to send registration to HubSpot:', error);
    // Continue with registration even if HubSpot fails
  }
  
  await sendConfirmationMail(
    newRegisterFormData.email,
    newRegisterFormData.hackathon_id as string
  );
  revalidatePath("/api/register-form/");

  return newRegisterFormData as unknown as RegistrationForm;
}
export async function getRegisterForm(email: string, hackathon_id: string) {
  const registeredData = await prisma.registerForm.findFirst({
    where: {
      user: {
        email: email,
      },
      hackathon_id: hackathon_id,
    },
  });

  return registeredData || null;
}
export async function sendConfirmationMail(
  email: string,
  hackathon_id: string
) {
  const hackathon = await prisma.hackathon.findUnique({
    where: { id: hackathon_id },
  });
  const text = `your registration application for ${hackathon?.title} has been approved.`;
  const subject = `Hackathon Registration`;
  const html = `
    <div style="background-color: #18181B; color: white; font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border-radius: 8px; border: 1px solid #EF4444; text-align: center;">
      <h2 style="color: white; font-size: 20px; margin-bottom: 16px;">Hackathon registration</h2>

      <div style="background-color: #27272A; border: 1px solid #EF4444; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <p style="font-size: 20px; font-weight: bold; color: #ffffff; margin: 8px 0;">Your registration for</p>
        <p style="font-size: 20px; font-weight: bold; color: #EF4444; margin: 8px 0;">${hackathon?.title}</p>
        <p style="font-size: 20px; font-weight: bold; color: #ffffff; margin: 8px 0;"> has been approved. Please <a href="https://t.me/c/avalancheacademy/4337" style="color: #3B82F6; text-decoration: underline;">join the hackathon chat</a>. </p>
        <p style="font-size: 10px; font-weight: bold; color: #ffffff; margin: 8px 0;">This is an automated message — please do not reply.</p>
      </div>

      <p style="font-size: 12px; color: #A1A1AA;">If you did not expect this invitation, you can safely ignore this email.</p>

      <div style="margin-top: 20px;">
        <img src="https://build.avax.network/logo-white.png" alt="Company Logo" style="max-width: 120px; margin-bottom: 10px;">
        <p style="font-size: 12px; color: #A1A1AA;">Avalanche Builder's Hub © 2025</p>
      </div>
    </div>
    `;
  try {
    await sendMail(email, html, subject, text);
  } catch (error) {
    console.error("Error sending confirmation email:", error);
  }
}

// Function to send registration data to HubSpot
export async function sendRegistrationToHubSpot(
  registrationData: any,
  hackathon: any
): Promise<void> {
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
      'telegram_handle': registrationData.telegram_user || '',
      'github_url': registrationData.github_portfolio || '',
      //'avalanche_ecosystem_member': registrationData.hackathon_participation || '',
      'hackathon_interests': registrationData.interests || '',
      'programming_language_familiarity': registrationData.languages || '',
      'employment_role_other': registrationData.roles || 'Other',
      'tooling_familiarity': registrationData.tools || '',
      'founder_check' : 'No', // TODO: add this to the BH form
      'avalanche_ecosystem_member' : 'No',  // TODO: add this to the BH form
      //'hackathon_event_id': registrationData.hackathon_id, // TODO: add this to the HS form
      //'hackathon_event_title': hackathon?.title || '', // TODO: add this to the HS form
      
      //'registration_utm_source': registrationData.utm || '', // TODO: add this to the HS form
      'marketing_consent': registrationData.newsletter_subscription ? 'Yes' : 'No', // TODO: add this to the HS form
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
        pageUri: 'https://build.avax.network/hackathons/registration-form',
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
