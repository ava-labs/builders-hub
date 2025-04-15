import { NextResponse } from 'next/server';

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_PORTAL_ID = process.env.HUBSPOT_PORTAL_ID;
const HUBSPOT_FORM_GUID = process.env.HUBSPOT_FORM_GUID;

export async function POST(request: Request) {
  try {
    if (!HUBSPOT_API_KEY || !HUBSPOT_PORTAL_ID || !HUBSPOT_FORM_GUID) {
      console.error('Missing environment variables: HUBSPOT_API_KEY, HUBSPOT_PORTAL_ID, or HUBSPOT_FORM_GUID');
      return NextResponse.json(
        { success: false, message: 'Server configuration error' },
        { status: 500 }
      );
    }

    const clonedRequest = request.clone();
    let formData;
    try {
      formData = await clonedRequest.json();
      console.log('Received form data:', formData);
    } catch (error) {
      console.error('Error parsing request body:', error);
      return NextResponse.json(
        { success: false, message: 'Invalid request body' },
        { status: 400 }
      );
    }

    const fieldMapping: { [key: string]: string[] } = {
      "twitterhandle": ["twitterhandle", "0-2/twitterhandle"],
      "company_whyyou": ["0-2/company_whyyou"],
      "new_user_onboard_number": ["0-2/new_user_onboard_number"],
      "project_description": ["0-2/project_description"],
      "project_vertical": ["0-2/project_vertical"],
      "project_kpi": ["0-2/project_kpi"],
      "project": ["0-2/project"],
      "link_github": ["0-2/link_github"],
      "ava_funding_check": ["0-2/ava_funding_check"],
      "team_background": ["0-2/team_background"],
      "company_competitors": ["0-2/company_competitors"],
      "launching_token": ["0-2/launching_token"],
      "grant_size_and_budget_breakdown": ["0-2/grant_size_and_budget_breakdown"],
      "website": ["0-2/website"],
      "token_launch_on_avalanche": ["0-2/token_launch_on_avalanche"],
      "ava_funding_amount": ["0-2/ava_funding_amount"],
      "retro9000_additional_value_or_features": ["0-2/retro9000_additional_value_or_features"],
      "kyb_willingness": ["0-2/kyb_willingness"],
      "firstname": ["firstname"],
      "lastname": ["lastname"],
      "email": ["email"],
      "telegram_handle": ["telegram_handle"],
      "gdpr": ["gdpr"],
      "marketing_consent": ["marketing_consent"]
    };
    
    const fields: { name: string; value: string | boolean }[] = [];
    Object.entries(formData).forEach(([name, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      
      let formattedValue: string | boolean = typeof value === 'string' || typeof value === 'boolean' ? value : String(value);
      if (typeof value === 'boolean') {
        if (name !== 'gdpr' && name !== 'marketing_consent') {
          formattedValue = value ? 'Yes' : 'No';
        }
      }

      const mappedFields = fieldMapping[name] || [name];

      mappedFields.forEach(fieldName => {
        fields.push({
          name: fieldName,
          value: formattedValue
        });
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
        pageUri: request.headers.get('referer') || 'https://your-website.com/grants',
        pageName: 'Retro9000 Grant Application'
      }
    };

    if (formData.gdpr === true) {
      hubspotPayload.legalConsentOptions = {
        consent: {
          consentToProcess: true,
          text: "I agree to allow Avalanche Foundation to store and process my personal data.",
          communications: [
            {
              value: formData.marketing_consent === true,
              subscriptionTypeId: 999,
              text: "I agree to receive marketing communications from Avalanche Foundation."
            }
          ]
        }
      };
    }
  
    const hubspotResponse = await fetch(
      `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_FORM_GUID}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${HUBSPOT_API_KEY}`
        },
        body: JSON.stringify(hubspotPayload)
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
    
    console.log('HubSpot response:', hubspotResult);
    if (!hubspotResponse.ok) {
      return NextResponse.json(
        { 
          success: false, 
          status: responseStatus,
          response: hubspotResult
        }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing form submission:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}