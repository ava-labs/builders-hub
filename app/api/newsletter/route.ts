import { NextResponse } from 'next/server';
import { isHubSpotEnabled, skipHubSpot } from '@/server/services/hubspot';
import { z } from 'zod';
import { readJsonBody } from '@/lib/api/json-body';
import { isValidEmail } from '@/lib/email';
import { clientBucket } from '@/lib/net/clientIp';
import { normalizeEmail } from '@/lib/utils';
import { consumeQuota } from '@/lib/verification/limits';

// Sign-ups one client address may send: each one writes a consent record for the address it names.
const SIGNUPS_PER_CLIENT = { limit: 20, windowMs: 60 * 60 * 1000 };

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_PORTAL_ID = process.env.HUBSPOT_PORTAL_ID;
const HUBSPOT_NEWSLETTER_FORM_GUID = process.env.HUBSPOT_NEWSLETTER_FORM_GUID;

const bodySchema = z.object({
  email: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    if (!isHubSpotEnabled()) {
      skipHubSpot('POST /api/newsletter');
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'HubSpot disabled in this environment; newsletter signup not pushed.',
      });
    }
    if (!HUBSPOT_API_KEY || !HUBSPOT_PORTAL_ID || !HUBSPOT_NEWSLETTER_FORM_GUID) {
      console.error('Missing environment variables: HUBSPOT_API_KEY, HUBSPOT_PORTAL_ID, or HUBSPOT_NEWSLETTER_FORM_GUID');
      return NextResponse.json(
        { success: false, message: 'Server config error' },
        { status: 500 }
      );
    }

    const formData = await readJsonBody(request, bodySchema);
    if (!formData) {
      return NextResponse.json(
        { success: false, message: 'Invalid request body' },
        { status: 400 }
      );
    }
    if (!formData.email) {
      return NextResponse.json(
        { success: false, message: 'Email is required' },
        { status: 400 }
      );
    }
    formData.email = normalizeEmail(formData.email);
    if (!isValidEmail(formData.email)) {
      return NextResponse.json({ success: false, message: 'Enter a valid email address.' }, { status: 400 });
    }
    const client = await consumeQuota(`newsletter:${clientBucket(request)}`, SIGNUPS_PER_CLIENT);
    if (!client.allowed) {
      return NextResponse.json({ success: false, message: 'Too many sign-ups. Try again later.' }, { status: 429 });
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
