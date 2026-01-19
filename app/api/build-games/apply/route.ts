import { NextResponse } from 'next/server';

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_PORTAL_ID = process.env.HUBSPOT_PORTAL_ID || '7522520';
const BUILD_GAMES_FORM_GUID = process.env.BUILD_GAMES_FORM_GUID || '2bab493b-9933-4076-8ace-f3cab2fe8cfb';

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

    Object.entries(formData).forEach(([key, value]) => {
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

    const hubspotResponse = await fetch(`https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${BUILD_GAMES_FORM_GUID}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`,
        },
        body: JSON.stringify(hubspotPayload),
      }
    );

    const responseStatus = hubspotResponse.status;
    let hubspotResult;

    try {
      const clonedResponse = hubspotResponse.clone();
      try {
        hubspotResult = await hubspotResponse.json();
      } catch (jsonError) {
        const text = await clonedResponse.text();
        console.error('Non-JSON response from HubSpot:', text);
        hubspotResult = { status: 'error', message: text };
      }
    } catch (error) {
      console.error('Error reading HubSpot response:', error);
      hubspotResult = { status: 'error', message: 'Could not read HubSpot response' };
    }

    if (!hubspotResponse.ok) {
      console.error('HubSpot submission failed:', hubspotResult);
      return NextResponse.json(
        {
          success: false,
          status: responseStatus,
          response: hubspotResult,
        },
        { status: responseStatus }
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
