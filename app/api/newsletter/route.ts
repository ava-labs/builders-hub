import { z } from 'zod';
import { withApi, successResponse, InternalError } from '@/lib/api';

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_PORTAL_ID = process.env.HUBSPOT_PORTAL_ID;
const HUBSPOT_NEWSLETTER_FORM_GUID = process.env.HUBSPOT_NEWSLETTER_FORM_GUID;

const newsletterSchema = z.object({
  email: z.string().email('Valid email is required'),
});

// withApi: auth intentionally omitted — public form submission
export const POST = withApi<z.infer<typeof newsletterSchema>>(
  async (req, { body }) => {
    if (!HUBSPOT_API_KEY || !HUBSPOT_PORTAL_ID || !HUBSPOT_NEWSLETTER_FORM_GUID) {
      throw new InternalError('Newsletter service not configured');
    }

    const hubspotPayload = {
      fields: [
        { name: 'email', value: body.email },
        { name: 'gdpr', value: true },
        { name: 'marketing_consent', value: true },
      ],
      context: {
        pageUri: req.headers.get('referer') || 'https://build.avax.network',
        pageName: 'Newsletter Signup',
      },
      legalConsentOptions: {
        consent: {
          consentToProcess: true,
          text: 'I agree to allow Ava Labs to store and process my personal data.',
          communications: [
            {
              value: true,
              subscriptionTypeId: 999,
              text: 'I agree to receive marketing communications from Ava Labs.',
            },
          ],
        },
      },
    };

    const hubspotResponse = await fetch(
      `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_NEWSLETTER_FORM_GUID}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${HUBSPOT_API_KEY}`,
        },
        body: JSON.stringify(hubspotPayload),
      },
    );

    if (!hubspotResponse.ok) {
      let hubspotResult;
      try {
        hubspotResult = await hubspotResponse.json();
      } catch {
        hubspotResult = { message: await hubspotResponse.text() };
      }
      throw new InternalError(`HubSpot submission failed: ${hubspotResult?.message || hubspotResponse.status}`);
    }

    return successResponse({ subscribed: true });
  },
  {
    schema: newsletterSchema,
    rateLimit: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 5,
      identifier: 'ip',
    },
  },
);
