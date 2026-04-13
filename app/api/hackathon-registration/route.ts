import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { BadRequestError, InternalError } from '@/lib/api/errors';

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_PORTAL_ID = process.env.HUBSPOT_PORTAL_ID;
const HUBSPOT_HACKATHON_FORM_GUID = process.env.HUBSPOT_HACKATHON_FORM_GUID;

const registrationSchema = z
  .object({
    email: z.string().email('Valid email is required'),
    name: z.string().optional(),
    city: z.string().optional(),
    role: z.string().optional(),
    company_name: z.string().optional(),
    telegram_user: z.string().optional(),
    github_portfolio: z.string().optional(),
    interests: z.union([z.array(z.string()), z.string()]).optional(),
    languages: z.union([z.array(z.string()), z.string()]).optional(),
    roles: z.union([z.array(z.string()), z.string()]).optional(),
    tools: z.union([z.array(z.string()), z.string()]).optional(),
    founder_check: z.boolean().optional(),
    avalanche_ecosystem_member: z.boolean().optional(),
    newsletter_subscription: z.boolean().optional(),
    terms_event_conditions: z.boolean().optional(),
    gdpr: z.boolean().optional(),
    marketing_consent: z.boolean().optional(),
  })
  .passthrough();

// withApi: auth intentionally omitted — public form submission
export const POST = withApi<z.infer<typeof registrationSchema>>(
  async (req: NextRequest, { body: formData }) => {
    if (!HUBSPOT_API_KEY || !HUBSPOT_PORTAL_ID || !HUBSPOT_HACKATHON_FORM_GUID) {
      throw new InternalError('Server configuration error');
    }

    // Process the form data for HubSpot
    const processedFormData: Record<string, any> = {};

    Object.entries(formData).forEach(([key, value]) => {
      if (['fullname', 'email', 'gdpr', 'marketing_consent'].includes(key)) {
        processedFormData[key] = value;
      } else {
        processedFormData[`hackathon_${key}`] = value;
      }
    });

    // Map specific hackathon fields
    processedFormData['fullname'] = formData.name || 'N/A';
    processedFormData['country_dropdown'] = formData.city || 'N/A';
    processedFormData['hs_role'] = formData.role || 'N/A';
    processedFormData['name'] = formData.company_name || '';
    processedFormData['telegram_handle'] = formData.telegram_user || '';
    processedFormData['github_url'] = formData.github_portfolio || '';
    processedFormData['hackathon_interests'] = Array.isArray(formData.interests)
      ? formData.interests.join(';')
      : formData.interests || '';
    processedFormData['programming_language_familiarity'] = Array.isArray(formData.languages)
      ? formData.languages.join(';')
      : formData.languages || '';
    processedFormData['employment_role_other'] = Array.isArray(formData.roles)
      ? formData.roles.join(';')
      : formData.roles || '';
    processedFormData['tooling_familiarity'] = Array.isArray(formData.tools)
      ? formData.tools.join(';')
      : formData.tools || '';
    processedFormData['founder_check'] = formData.founder_check ? 'Yes' : 'No';
    processedFormData['avalanche_ecosystem_member'] = formData.avalanche_ecosystem_member ? 'Yes' : 'No';

    // Map boolean fields
    processedFormData['marketing_consent'] = formData.newsletter_subscription === true ? 'Yes' : 'No';
    processedFormData['gdpr'] = formData.terms_event_conditions === true ? 'Yes' : 'No';

    // Build HubSpot payload fields
    const fields: { name: string; value: string | boolean }[] = [];
    Object.entries(processedFormData).forEach(([name, value]) => {
      if (value === undefined || value === null || value === '') return;
      const formattedValue: string | boolean =
        typeof value === 'string' || typeof value === 'boolean' ? value : String(value);
      fields.push({ name, value: formattedValue });
    });

    interface HubspotPayload {
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
    }

    const hubspotPayload: HubspotPayload = {
      fields,
      context: {
        pageUri: req.headers.get('referer') || 'https://build.avax.network',
        pageName: 'Hackathon Registration',
      },
    };

    // Add legal consent if GDPR is agreed to
    if (formData.gdpr === true) {
      hubspotPayload.legalConsentOptions = {
        consent: {
          consentToProcess: true,
          text: 'I agree to allow Avalanche Foundation to store and process my personal data for hackathon participation purposes.',
          communications: [
            {
              value: formData.marketing_consent === true,
              subscriptionTypeId: 999,
              text: 'I would like to receive marketing emails from the Avalanche Foundation.',
            },
          ],
        },
      };
    }

    const hubspotResponse = await fetch(
      `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_HACKATHON_FORM_GUID}`,
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
      const responseStatus = hubspotResponse.status;
      let detail: string;
      try {
        const result = await hubspotResponse.json();
        detail = JSON.stringify(result);
      } catch {
        detail = hubspotResponse.statusText;
      }
      throw new BadRequestError(`HubSpot API error: ${responseStatus} - ${detail}`);
    }

    const hubspotResult = await hubspotResponse.json().catch(() => ({}));

    return successResponse({
      message: 'Hackathon registration sent to HubSpot successfully',
      response: hubspotResult,
    });
  },
  { schema: registrationSchema },
);
