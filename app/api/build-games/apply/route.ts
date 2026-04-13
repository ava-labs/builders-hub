import type { NextRequest } from 'next/server';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { BadRequestError, InternalError, ValidationError } from '@/lib/api/errors';
import { prisma } from '@/prisma/prisma';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_PORTAL_ID = process.env.HUBSPOT_PORTAL_ID || '7522520';
const BUILD_GAMES_FORM_GUID = process.env.BUILD_GAMES_FORM_GUID || '2bab493b-9933-4076-8ace-f3cab2fe8cfb';
const DEFAULT_GITHUB_URL = 'https://github.com/ava-labs/builders-hub';

const FIELD_GROUP_PREFIX = '2-49793193/';

/** Allowlisted form keys that may be forwarded to HubSpot. */
const HUBSPOT_FIELD_MAPPING: Record<string, string> = {
  firstName: 'firstname',
  lastName: `${FIELD_GROUP_PREFIX}applicant_last_name`,
  email: 'email',
  hackathonName: 'hackathon_name',
  telegram: 'telegram_handle',
  github: `${FIELD_GROUP_PREFIX}github`,
  country: `${FIELD_GROUP_PREFIX}country_dropdown`,
  readyToWin: `${FIELD_GROUP_PREFIX}application_condition`,
  previousAvalancheGrant: `${FIELD_GROUP_PREFIX}previous_grant_support_avalanche`,
  hackathonExperience: 'hackathon_experience',
  hackathonDetails: 'hackathon_details',
  employmentRole: 'employment_role',
  currentRole: 'current_role',
  employmentStatus: 'employment_status',
  projectName: `${FIELD_GROUP_PREFIX}company_project_name`,
  projectDescription: `${FIELD_GROUP_PREFIX}company_description_one_line`,
  areaOfFocus: `${FIELD_GROUP_PREFIX}area_of_focus`,
  whyYou: `${FIELD_GROUP_PREFIX}why_you`,
  howDidYouHear: `${FIELD_GROUP_PREFIX}applicant_source`,
  howDidYouHearSpecify: `${FIELD_GROUP_PREFIX}applicant_source_other`,
  referrerName: 'referrer_name',
  universityAffiliation: 'university_affiliated',
  avalancheEcosystemMember: 'avalanche_ecosystem_member',
  privacyPolicyRead: 'gdpr',
  marketingConsent: 'marketing_consent',
};

/** Fields that are stored in our DB only; never forwarded to HubSpot. */
const INTERNAL_ONLY_FIELDS = new Set(['referrer']);

/** All keys the client is allowed to submit. */
const ALLOWED_KEYS = new Set([...Object.keys(HUBSPOT_FIELD_MAPPING), ...INTERNAL_ONLY_FIELDS]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildHubSpotFields(formData: Record<string, unknown>) {
  const fields: { name: string; value: string | boolean }[] = [];
  const hubspotRequiredFields = [`${FIELD_GROUP_PREFIX}applicant_source_other`];

  // Only iterate over allowlisted keys (mass-assignment guard)
  for (const key of Object.keys(formData)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    if (INTERNAL_ONLY_FIELDS.has(key)) continue;

    const value = formData[key];
    const hubspotFieldName = HUBSPOT_FIELD_MAPPING[key] || key;

    if (value === undefined || value === null || value === '') {
      if (hubspotRequiredFields.includes(hubspotFieldName)) {
        fields.push({ name: hubspotFieldName, value: '' });
      }
      continue;
    }

    let formattedValue: string | boolean;
    if (typeof value === 'boolean') {
      formattedValue = key === 'privacyPolicyRead' || key === 'marketingConsent' ? value : value ? 'Yes' : 'No';
    } else if (typeof value === 'string') {
      formattedValue = value === 'yes' ? 'Yes' : value === 'no' ? 'No' : value;
    } else {
      formattedValue = String(value);
    }

    fields.push({ name: hubspotFieldName, value: formattedValue });
  }

  // Ensure HubSpot required fields are always present
  for (const requiredField of hubspotRequiredFields) {
    if (!fields.some((f) => f.name === requiredField)) {
      fields.push({ name: requiredField, value: '' });
    }
  }

  // Default GitHub URL
  const githubFieldName = HUBSPOT_FIELD_MAPPING['github'];
  const githubIdx = fields.findIndex((f) => f.name === githubFieldName);
  if (githubIdx === -1) {
    fields.push({ name: githubFieldName, value: DEFAULT_GITHUB_URL });
  } else if (!fields[githubIdx].value) {
    fields[githubIdx].value = DEFAULT_GITHUB_URL;
  }

  // Default "specify" from howDidYouHear
  const specifyFieldName = HUBSPOT_FIELD_MAPPING['howDidYouHearSpecify'];
  const specifyIdx = fields.findIndex((f) => f.name === specifyFieldName);
  const howDidYouHearValue = (formData.howDidYouHear as string) || '';
  if (specifyIdx === -1) {
    fields.push({ name: specifyFieldName, value: howDidYouHearValue });
  } else if (!fields[specifyIdx].value) {
    fields[specifyIdx].value = howDidYouHearValue;
  }

  return fields;
}

async function submitToHubSpot(
  fields: { name: string; value: string | boolean }[],
  formData: Record<string, unknown>,
  referer: string | null,
): Promise<{ success: boolean; status: number; data: any; error?: string }> {
  const hubspotPayload: Record<string, any> = {
    fields,
    context: {
      pageUri: referer || 'https://build.avax.network/build-games/apply',
      pageName: 'Build Games 2026 Application',
    },
  };

  if (formData.privacyPolicyRead === true) {
    hubspotPayload.legalConsentOptions = {
      consent: {
        consentToProcess: true,
        text: 'I agree to allow Avalanche Foundation to store and process my personal data.',
        communications: [
          {
            value: formData.marketingConsent === true,
            subscriptionTypeId: 999,
            text: 'I agree to receive marketing communications from Avalanche Foundation.',
          },
        ],
      },
    };
  }

  const url = `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${BUILD_GAMES_FORM_GUID}`;

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${HUBSPOT_API_KEY}`,
        },
        body: JSON.stringify(hubspotPayload),
      },
      60_000,
    );

    let data: any;
    try {
      const text = await response.text();
      data = JSON.parse(text);
    } catch {
      data = { message: 'Could not parse response' };
    }

    return { success: response.ok, status: response.status, data };
  } catch (err) {
    return { success: false, status: 0, data: null, error: (err as Error).message };
  }
}

async function saveToDatabase(
  formData: Record<string, unknown>,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const email = formData.email as string;
  if (!email) return { success: false, error: 'Email is required' };

  try {
    const applicationData = {
      email,
      first_name: (formData.firstName as string) || '',
      last_name: (formData.lastName as string) || '',
      telegram: (formData.telegram as string) || null,
      github: (formData.github as string) || null,
      country: (formData.country as string) || '',
      ready_to_win: (formData.readyToWin as string) || '',
      previous_avalanche_grant: (formData.previousAvalancheGrant as string) || '',
      hackathon_experience: (formData.hackathonExperience as string) || null,
      hackathon_details: (formData.hackathonDetails as string) || null,
      employment_role: (formData.employmentRole as string) || null,
      current_role: (formData.currentRole as string) || null,
      employment_status: (formData.employmentStatus as string) || null,
      project_name: (formData.projectName as string) || '',
      project_description: (formData.projectDescription as string) || '',
      area_of_focus: (formData.areaOfFocus as string) || '',
      why_you: (formData.whyYou as string) || '',
      how_did_you_hear: (formData.howDidYouHear as string) || '',
      how_did_you_hear_specify: (formData.howDidYouHearSpecify as string) || null,
      referrer_name: (formData.referrerName as string) || null,
      referrer_handle: (formData.referrer as string) || null,
      university_affiliation: (formData.universityAffiliation as string) || '',
      avalanche_ecosystem_member: (formData.avalancheEcosystemMember as string) || '',
      privacy_policy_read: formData.privacyPolicyRead === true,
      marketing_consent: formData.marketingConsent === true,
    };

    const result = await prisma.buildGamesApplication.upsert({
      where: { email },
      update: { ...applicationData, email: undefined } as any,
      create: applicationData,
    });

    return { success: true, id: result.id };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// ---------------------------------------------------------------------------
// POST /api/build-games/apply
// ---------------------------------------------------------------------------

// withApi: auth intentionally omitted — public application form
// schema: not applicable — dynamic HubSpot field mapping with allowlist guard
export const POST = withApi(async (req: NextRequest) => {
  if (!HUBSPOT_API_KEY) {
    throw new InternalError('Server configuration error');
  }

  let formData: Record<string, unknown>;
  try {
    formData = await req.json();
  } catch {
    throw new ValidationError('Invalid request body');
  }

  // Mass-assignment guard: reject unknown keys
  const unknownKeys = Object.keys(formData).filter((k) => !ALLOWED_KEYS.has(k));
  if (unknownKeys.length > 0) {
    throw new BadRequestError(`Unknown fields: ${unknownKeys.join(', ')}`);
  }

  const fields = buildHubSpotFields(formData);
  const referer = req.headers.get('referer');

  const [hubspotResult, dbResult] = await Promise.all([
    submitToHubSpot(fields, formData, referer),
    saveToDatabase(formData),
  ]);

  if (!hubspotResult.success || !dbResult.success) {
    const failedSystems: string[] = [];
    if (!hubspotResult.success) failedSystems.push('HubSpot');
    if (!dbResult.success) failedSystems.push('Database');

    throw new InternalError(`Submission failed: ${failedSystems.join(' and ')}`);
  }

  return successResponse({ submitted: true }, 201);
});
