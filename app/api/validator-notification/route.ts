import { NextResponse } from 'next/server';

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_PORTAL_ID = process.env.HUBSPOT_PORTAL_ID;
const VALIDATOR_FORM_GUID = process.env.VALIDATOR_FORM_GUID;

export async function POST(request: Request) {
  try {
    if (!HUBSPOT_API_KEY || !HUBSPOT_PORTAL_ID) {
      console.error('Missing environment variables: HUBSPOT_API_KEY or HUBSPOT_PORTAL_ID');
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

    const fieldMapping: { [key: string]: string[] } = {
      "email": ["email"],
      "firstname": ["firstname"],
      "lastname": ["lastname"],
      "company": ["company"],
      "company_description_vertical": ["company_description_vertical"],
      "subnet_type": ["subnet_type"],
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
        pageUri: request.headers.get('referer') || 'https://build.avax.network',
        pageName: 'Validator Email Collection'
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
      `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${VALIDATOR_FORM_GUID}`,
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
    console.error('Error processing validator form submission:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
} 