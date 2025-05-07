import { NextResponse } from 'next/server';

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_PORTAL_ID = process.env.HUBSPOT_PORTAL_ID;
const HUBSPOT_NEWSLETTER_FORM_GUID = process.env.HUBSPOT_NEWSLETTER_FORM_GUID;

export async function POST(request: Request) {
  try {
    if (!HUBSPOT_API_KEY || !HUBSPOT_PORTAL_ID || !HUBSPOT_NEWSLETTER_FORM_GUID) {
      console.error('Missing environment variables: HUBSPOT_API_KEY, HUBSPOT_PORTAL_ID, or HUBSPOT_NEWSLETTER_FORM_GUID');
      return NextResponse.json(
        { success: false, message: 'Server config error' },
        { status: 500 }
      );
    }

    const formData = await request.json();
    console.log('Received newsletter signup:', formData);

    if (!formData.email) {
      return NextResponse.json(
        { success: false, message: 'Email is required' },
        { status: 400 }
      );
    }

    const hubspotPayload = {
      fields: [
        {
          name: "email",
          value: formData.email
        },
        {
          name: "gdpr",
          value: true
        },
        {
          name: "marketing_consent",
          value: true
        }
      ],
      context: {
        pageUri: request.headers.get('referer') || 'https://build.avax.network',
        pageName: 'Newsletter Signup'
      },
      legalConsentOptions: {
        consent: {
          consentToProcess: true,
          text: "I agree to allow Ava Labs to store and process my personal data.",
          communications: [
            {
              value: true,
              subscriptionTypeId: 999,
              text: "I agree to receive marketing communications from Ava Labs."
            }
          ]
        }
      }
    };

    const hubspotResponse = await fetch(
      `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_NEWSLETTER_FORM_GUID}`,
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
      hubspotResult = await hubspotResponse.json();
    } catch (error) {
      console.error('Error reading HubSpot response:', error);
      const text = await hubspotResponse.text();
      console.error('Non-JSON response from HubSpot:', text);
      hubspotResult = { status: 'error', message: text };
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
    console.error('Error processing newsletter signup:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
