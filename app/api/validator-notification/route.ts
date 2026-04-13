import { z } from 'zod';
import { withApi, successResponse, InternalError } from '@/lib/api';

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_PORTAL_ID = process.env.HUBSPOT_PORTAL_ID;
const VALIDATOR_FORM_GUID = process.env.VALIDATOR_FORM_GUID;
const HUBSPOT_TIMEOUT = 10_000;

const validatorNotificationSchema = z.object({
  email: z.string().email('Valid email is required'),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  company: z.string().optional(),
  company_description_vertical: z.string().optional(),
  subnet_type: z.string().optional(),
  gdpr: z.boolean().optional(),
  marketing_consent: z.boolean().optional(),
});

type ValidatorNotificationBody = z.infer<typeof validatorNotificationSchema>;

export const POST = withApi<ValidatorNotificationBody>(
  async (request, { body }) => {
    if (!HUBSPOT_API_KEY || !HUBSPOT_PORTAL_ID) {
      throw new InternalError('Server configuration error');
    }

    const fieldMapping: Record<string, string[]> = {
      email: ['email'],
      firstname: ['firstname'],
      lastname: ['lastname'],
      company: ['company'],
      company_description_vertical: ['company_description_vertical'],
      subnet_type: ['subnet_type'],
      gdpr: ['gdpr'],
      marketing_consent: ['marketing_consent'],
    };

    const fields: { name: string; value: string | boolean }[] = [];
    for (const [name, value] of Object.entries(body)) {
      if (value === undefined || value === null || value === '') continue;

      let formattedValue: string | boolean =
        typeof value === 'string' || typeof value === 'boolean' ? value : String(value);
      if (typeof value === 'boolean') {
        if (name !== 'gdpr' && name !== 'marketing_consent') {
          formattedValue = value ? 'Yes' : 'No';
        }
      }

      const mappedFields = fieldMapping[name] || [name];
      for (const fieldName of mappedFields) {
        fields.push({ name: fieldName, value: formattedValue });
      }
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
      fields,
      context: {
        pageUri: request.headers.get('referer') || 'https://build.avax.network',
        pageName: 'Validator Email Collection',
      },
    };

    if (body.gdpr === true) {
      hubspotPayload.legalConsentOptions = {
        consent: {
          consentToProcess: true,
          text: 'I agree to allow Avalanche Foundation to store and process my personal data.',
          communications: [
            {
              value: body.marketing_consent === true,
              subscriptionTypeId: 999,
              text: 'I agree to receive marketing communications from Avalanche Foundation.',
            },
          ],
        },
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HUBSPOT_TIMEOUT);

    try {
      const hubspotResponse = await fetch(
        `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${VALIDATOR_FORM_GUID}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${HUBSPOT_API_KEY}`,
          },
          body: JSON.stringify(hubspotPayload),
          signal: controller.signal,
        },
      );
      clearTimeout(timeout);

      if (!hubspotResponse.ok) {
        let hubspotResult: any;
        try {
          hubspotResult = await hubspotResponse.json();
        } catch {
          hubspotResult = { message: await hubspotResponse.text().catch(() => 'Unknown error') };
        }
        throw new InternalError(hubspotResult?.message || `HubSpot returned ${hubspotResponse.status}`);
      }

      return successResponse({ success: true });
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  },
  { auth: true, schema: validatorNotificationSchema },
);
