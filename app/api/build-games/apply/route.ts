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

    // Use "how did you hear" selection as default for "specify" field if not provided
    const specifyFieldName = HUBSPOT_FIELD_MAPPING['howDidYouHearSpecify'];
    const specifyFieldIndex = fields.findIndex((f) => f.name === specifyFieldName);
    const howDidYouHearValue = formData.howDidYouHear as string || '';
    if (specifyFieldIndex === -1) {
      fields.push({ name: specifyFieldName, value: howDidYouHearValue });
    } else if (!fields[specifyFieldIndex].value) {
      fields[specifyFieldIndex].value = howDidYouHearValue;
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

// Save application to BuildGamesApplication table
async function saveToDatabase(formData: Record<string, unknown>): Promise<{ success: boolean; id?: string; error?: string }> {
  console.log('[Build Games Apply DB] Starting database save...');

  const email = formData.email as string;
  console.log('[Build Games Apply DB] Email:', email);
  if (!email) return { success: false, error: 'Email is required' };

  try {
    const applicationData = {
      email: email,
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

    console.log('[Build Games Apply DB] Upserting application with data:', JSON.stringify(applicationData, null, 2));

    const result = await prisma.buildGamesApplication.upsert({
      where: { email: email },
      update: {
        first_name: applicationData.first_name,
        last_name: applicationData.last_name,
        telegram: applicationData.telegram,
        github: applicationData.github,
        country: applicationData.country,
        ready_to_win: applicationData.ready_to_win,
        previous_avalanche_grant: applicationData.previous_avalanche_grant,
        hackathon_experience: applicationData.hackathon_experience,
        hackathon_details: applicationData.hackathon_details,
        employment_role: applicationData.employment_role,
        current_role: applicationData.current_role,
        employment_status: applicationData.employment_status,
        project_name: applicationData.project_name,
        project_description: applicationData.project_description,
        area_of_focus: applicationData.area_of_focus,
        why_you: applicationData.why_you,
        how_did_you_hear: applicationData.how_did_you_hear,
        how_did_you_hear_specify: applicationData.how_did_you_hear_specify,
        referrer_name: applicationData.referrer_name,
        referrer_handle: applicationData.referrer_handle,
        university_affiliation: applicationData.university_affiliation,
        avalanche_ecosystem_member: applicationData.avalanche_ecosystem_member,
        privacy_policy_read: applicationData.privacy_policy_read,
        marketing_consent: applicationData.marketing_consent,
      },
      create: applicationData,
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
