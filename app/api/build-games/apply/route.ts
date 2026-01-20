import { NextResponse } from 'next/server';
import { prisma } from '@/prisma/prisma';

async function fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {...options, signal: controller.signal});
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_PORTAL_ID = process.env.HUBSPOT_PORTAL_ID || '7522520';
const BUILD_GAMES_FORM_GUID = process.env.BUILD_GAMES_FORM_GUID || '2bab493b-9933-4076-8ace-f3cab2fe8cfb';
const BUILD_GAMES_HACKATHON_ID = process.env.BUILD_GAMES_HACKATHON_ID;
const DEFAULT_GITHUB_URL = 'https://github.com/ava-labs/builders-hub';

// Map form field names to HubSpot field names
// Field names from HubSpot form: 2bab493b-9933-4076-8ace-f3cab2fe8cfb
const FIELD_GROUP_PREFIX = '2-49793193/';

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

export async function POST(request: Request) {
  try {
    if (!HUBSPOT_API_KEY) {
      console.error('Missing environment variable: HUBSPOT_API_KEY');
      return NextResponse.json(
        { success: false, message: 'Server configuration error' },
        { status: 500 }
      );
    }

    const clonedRequest = request.clone();
    let formData;
    try {
      formData = await clonedRequest.json();
    } catch (error) {
      console.error('Error parsing request body:', error);
      return NextResponse.json(
        { success: false, message: 'Invalid request body' },
        { status: 400 }
      );
    }

    const fields: { name: string; value: string | boolean }[] = [];
    const hubspotRequiredFields = [`${FIELD_GROUP_PREFIX}applicant_source_other`];
    // Fields that are only for our database, not HubSpot
    const internalOnlyFields = ['referrer'];

    Object.entries(formData).forEach(([key, value]) => {
      // Skip internal-only fields that shouldn't go to HubSpot
      if (internalOnlyFields.includes(key)) {
        return;
      }

      const hubspotFieldName = HUBSPOT_FIELD_MAPPING[key] || key;

      if (value === undefined || value === null || value === '') {
        if (hubspotRequiredFields.includes(hubspotFieldName)) {
          fields.push({ name: hubspotFieldName, value: '' });
        }
        return;
      }

      let formattedValue: string | boolean;

      if (typeof value === 'boolean') {
        if (key === 'privacyPolicyRead' || key === 'marketingConsent') { formattedValue = value }
        else { formattedValue = value ? 'Yes' : 'No' }
      } else if (typeof value === 'string') {
        formattedValue = value === 'yes' ? 'Yes' : value === 'no' ? 'No' : value;
      } else { formattedValue = String(value) }

      fields.push({
        name: hubspotFieldName,
        value: formattedValue,
      });
    });

    // Ensure HubSpot required fields are always included (even if not in form data)
    hubspotRequiredFields.forEach((requiredField) => {
      const fieldExists = fields.some((f) => f.name === requiredField);
      if (!fieldExists) {
        fields.push({ name: requiredField, value: '' });
      }
    });

    // Use default GitHub URL if not provided (HubSpot requires this field)
    const githubFieldName = HUBSPOT_FIELD_MAPPING['github'];
    const githubFieldIndex = fields.findIndex((f) => f.name === githubFieldName);
    if (githubFieldIndex === -1) {
      fields.push({ name: githubFieldName, value: DEFAULT_GITHUB_URL });
    } else if (!fields[githubFieldIndex].value) {
      fields[githubFieldIndex].value = DEFAULT_GITHUB_URL;
    }

    const hubspotPayload: {
      fields: { name: string; value: string | boolean }[];
      context: { pageUri: string; pageName: string };
      legalConsentOptions?: {
        consent: {
          consentToProcess: boolean;
          text: string;
          communications: Array<{
            value: boolean;
            subscriptionTypeId: number;
            text: string;
          }>;
        };
      };
    } = {
      fields: fields,
      context: {
        pageUri: request.headers.get('referer') || 'https://build.avax.network/build-games/apply',
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

    // Run HubSpot submission and DB save in parallel
    console.log('[Build Games Apply] Starting submission...');
    console.log('[Build Games Apply] HubSpot payload fields:', JSON.stringify(fields, null, 2));
    console.log('[Build Games Apply] HubSpot legal consent:', JSON.stringify(hubspotPayload.legalConsentOptions, null, 2));

    const hubspotUrl = `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${BUILD_GAMES_FORM_GUID}`;
    console.log('[Build Games Apply] HubSpot URL:', hubspotUrl);

    const hubspotPromise = fetchWithTimeout(hubspotUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        },
        body: JSON.stringify(hubspotPayload),
      },
      60000 // 60 second timeout
    );

    // Save to database (runs in parallel with HubSpot)
    const dbPromise = saveToDatabase(formData);

    const [hubspotResult, dbResult] = await Promise.all([
      hubspotPromise
        .then(async (response) => {
          const status = response.status;
          console.log('[Build Games Apply] HubSpot response status:', status);
          let data;
          try {
            const responseText = await response.text();
            console.log('[Build Games Apply] HubSpot response body:', responseText);
            try {
              data = JSON.parse(responseText);
            } catch {
              data = { message: responseText || 'Could not parse response' };
            }
          } catch (e) {
            console.error('[Build Games Apply] Error reading HubSpot response:', e);
            data = { message: 'Could not read response' };
          }
          return { success: response.ok, status, data };
        })
        .catch((err) => {
          console.error('[Build Games Apply] HubSpot request failed:', err);
          return { success: false, status: 0, data: null, error: err.message };
        }),
      dbPromise,
    ]);

    const hubspotSuccess = hubspotResult.success;
    const dbSuccess = dbResult.success;

    console.log('[Build Games Apply] Results - HubSpot:', hubspotSuccess ? 'success' : 'failed', '| DB:', dbSuccess ? 'success' : 'failed');
    console.log('[Build Games Apply] HubSpot result:', JSON.stringify(hubspotResult, null, 2));
    console.log('[Build Games Apply] DB result:', JSON.stringify(dbResult, null, 2));

    if (!hubspotSuccess || !dbSuccess) {
      const failedSystems = [];
      if (!hubspotSuccess) failedSystems.push('HubSpot');
      if (!dbSuccess) failedSystems.push('Database');

      console.error(`[Build Games Apply] Submission failed: ${failedSystems.join(' and ')} failed`);

      return NextResponse.json(
        {
          success: false,
          message: 'Application submission failed. Please try again.',
          details: {
            hubspot: hubspotSuccess ? 'success' : ('error' in hubspotResult ? hubspotResult.error : hubspotResult.data),
            database: dbSuccess ? 'success' : (dbResult.error || 'Unknown error'),
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing Build Games application:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// Save application to database
async function saveToDatabase(formData: Record<string, unknown>): Promise<{ success: boolean; id?: string; error?: string }> {
  console.log('[Build Games Apply DB] Starting database save...');

  if (!BUILD_GAMES_HACKATHON_ID) {
    console.warn('[Build Games Apply DB] BUILD_GAMES_HACKATHON_ID not set, skipping database save');
    return { success: false, error: 'Hackathon ID not configured' };
  }

  const email = formData.email as string;
  console.log('[Build Games Apply DB] Email:', email);
  if (!email) return { success: false, error: 'Email is required' };

  try {
    console.log('[Build Games Apply DB] Looking up user...');
    const user = await prisma.user.findUnique({
      where: { email: email },
      select: { id: true },
    });

    if (!user) {
      console.error(`[Build Games Apply DB] User with email ${email} not found in database`);
      return { success: false, error: 'User not found. Please ensure you are logged in.' };
    }
    console.log('[Build Games Apply DB] User found:', user.id);

    // Verify hackathon exists
    console.log('[Build Games Apply DB] Looking up hackathon:', BUILD_GAMES_HACKATHON_ID);
    const hackathon = await prisma.hackathon.findUnique({
      where: { id: BUILD_GAMES_HACKATHON_ID },
      select: { id: true },
    });

    if (!hackathon) {
      console.error(`[Build Games Apply DB] Hackathon with ID ${BUILD_GAMES_HACKATHON_ID} not found`);
      return { success: false, error: 'Hackathon configuration error' };
    }
    console.log('[Build Games Apply DB] Hackathon found');

    const registrationData = {
      name: `${formData.firstName || ''} ${formData.lastName || ''}`.trim(),
      email: email,
      city: (formData.country as string) || '',
      telegram_user: (formData.telegram as string) || null,
      github_portfolio: (formData.github as string) || null,
      role: (formData.employmentRole as string) || '',
      hackathon_participation: formData.hackathonExperience === 'yes' ? 'Yes, participated before' : 'No prior experience',
      newsletter_subscription: formData.marketingConsent === true,
      terms_event_conditions: formData.privacyPolicyRead === true,
      utm: (formData.howDidYouHear as string) || '',
      referrer_handle: (formData.referrer as string) || null,
      interests: '',
      languages: '',
      roles: '',
      tools: '',
      web3_proficiency: '',
      prohibited_items: false,
    };

    console.log('[Build Games Apply DB] Upserting registration with data:', JSON.stringify(registrationData, null, 2));
    const result = await prisma.registerForm.upsert({
      where: {
        hackathon_id_email: {
          hackathon_id: BUILD_GAMES_HACKATHON_ID,
          email: email,
        },
      },
      update: {
        name: registrationData.name,
        city: registrationData.city,
        telegram_user: registrationData.telegram_user,
        github_portfolio: registrationData.github_portfolio,
        role: registrationData.role,
        hackathon_participation: registrationData.hackathon_participation,
        newsletter_subscription: registrationData.newsletter_subscription,
        terms_event_conditions: registrationData.terms_event_conditions,
        utm: registrationData.utm,
        referrer_handle: registrationData.referrer_handle,
      },
      create: {
        hackathon: {
          connect: { id: BUILD_GAMES_HACKATHON_ID },
        },
        user: {
          connect: { email: email },
        },
        name: registrationData.name,
        city: registrationData.city,
        telegram_user: registrationData.telegram_user,
        github_portfolio: registrationData.github_portfolio,
        role: registrationData.role,
        hackathon_participation: registrationData.hackathon_participation,
        newsletter_subscription: registrationData.newsletter_subscription,
        terms_event_conditions: registrationData.terms_event_conditions,
        utm: registrationData.utm,
        referrer_handle: registrationData.referrer_handle,
        interests: registrationData.interests,
        languages: registrationData.languages,
        roles: registrationData.roles,
        tools: registrationData.tools,
        web3_proficiency: registrationData.web3_proficiency,
        prohibited_items: registrationData.prohibited_items,
      },
    });
    console.log('[Build Games Apply DB] Successfully saved, ID:', result.id);
    return { success: true, id: result.id };
  } catch (error) {
    console.error('[Build Games Apply DB] Error saving to database:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Database error'
    };
  }
}
