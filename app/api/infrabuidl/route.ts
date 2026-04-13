import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApi } from '@/lib/api/with-api';
import { successResponse } from '@/lib/api/response';
import { BadRequestError, InternalError } from '@/lib/api/errors';

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_PORTAL_ID = process.env.HUBSPOT_PORTAL_ID;
const HUBSPOT_INFRABUIDL_FORM_GUID = process.env.HUBSPOT_INFRABUIDL_FORM_GUID;

const infrabuidlSchema = z
  .object({
    firstname: z.string().min(1),
    lastname: z.string().min(1),
    email: z.string().email(),
    gdpr: z.boolean().optional(),
    marketing_consent: z.boolean().optional(),
  })
  .passthrough();

// withApi: auth intentionally omitted — public form submission
export const POST = withApi<z.infer<typeof infrabuidlSchema>>(
  async (req: NextRequest, { body: formData }) => {
    if (!HUBSPOT_API_KEY || !HUBSPOT_PORTAL_ID || !HUBSPOT_INFRABUIDL_FORM_GUID) {
      throw new InternalError('Server configuration error');
    }

    const processedFormData: Record<string, any> = {};

    Object.entries(formData as Record<string, any>).forEach(([key, value]) => {
      if (['firstname', 'lastname', 'email', 'gdpr', 'marketing_consent'].includes(key)) {
        processedFormData[key] = value;
      } else {
        processedFormData[`2-44649732/${key}`] = value;
      }
    });

    // Handle conditional fields with defaults
    processedFormData['2-44649732/project_type_ai'] = (formData as any).project_type || 'N/A';
    processedFormData['2-44649732/project_type_other'] = (formData as any).project_type_other || 'N/A';
    processedFormData['2-44649732/token_launch_other'] = (formData as any).token_launch_other || 'N/A';
    processedFormData['2-44649732/direct_competitor_1'] = (formData as any).direct_competitor_1 || 'N/A';
    processedFormData['2-44649732/applicant_job_role_other'] = (formData as any).applicant_job_role_other || 'N/A';
    processedFormData['2-44649732/avalanche_l1_project_benefited_1'] =
      (formData as any).avalanche_l1_project_benefited_1 || 'N/A';
    processedFormData['2-44649732/previous_avalanche_project_info'] =
      (formData as any).previous_avalanche_project_info || 'N/A';
    processedFormData['2-44649732/direct_competitor_1_website'] =
      (formData as any).direct_competitor_1_website || 'N/A';
    processedFormData['2-44649732/program_referrer'] = (formData as any).program_referrer || 'N/A';
    processedFormData['2-44649732/multichain_chains'] = (formData as any).multichain_chains || 'N/A';
    processedFormData['2-44649732/avalanche_l1_project_benefited_1_website'] =
      (formData as any).avalanche_l1_project_benefited_1_website || 'N/A';
    processedFormData['2-44649732/applicant_first_name'] = formData.firstname;
    processedFormData['2-44649732/applicant_last_name'] = formData.lastname;

    // Handle old field structure for backward compatibility
    processedFormData['2-44649732/funding_round'] = 'N/A';
    processedFormData['2-44649732/funding_amount'] = 'N/A';
    processedFormData['2-44649732/funding_entity'] = 'N/A';
    processedFormData['2-44649732/requested_funding_range'] =
      (formData as any).requested_funding_range_milestone || 'N/A';

    // Handle new funding amount fields
    processedFormData['2-44649732/previous_funding_amount_codebase'] = (formData as any).funding_amount_codebase || '0';
    processedFormData['2-44649732/previous_funding_amount_infrabuidl'] =
      (formData as any).funding_amount_infrabuidl || '0';
    processedFormData['2-44649732/previous_funding_amount_infrabuidl_ai'] =
      (formData as any).funding_amount_infrabuidl_ai || '0';
    processedFormData['2-44649732/retro9000_previous_funding_amount'] =
      (formData as any).funding_amount_retro9000 || '0';
    processedFormData['2-44649732/previous_funding_amount_blizzard'] = (formData as any).funding_amount_blizzard || '0';
    processedFormData['2-44649732/previous_funding_amount_ava_labs'] = (formData as any).funding_amount_ava_labs || '0';
    processedFormData['2-44649732/previous_funding_amount_entity_other'] =
      (formData as any).funding_amount_other_avalanche || '0';

    // Handle previous funding non-avalanche fields
    const previousFunding = Array.isArray((formData as any).previous_funding)
      ? (formData as any).previous_funding
      : [(formData as any).previous_funding];
    processedFormData['2-44649732/previous_funding_non_avalanche_grant'] = previousFunding.includes('Grant')
      ? 'Yes'
      : 'No';
    processedFormData['2-44649732/previous_funding_non_avalanche___angel_investment'] = previousFunding.includes(
      'Angel Investment',
    )
      ? 'Yes'
      : 'No';
    processedFormData['2-44649732/previous_funding_non_avalanche___pre_seed'] = previousFunding.includes('Pre-Seed')
      ? 'Yes'
      : 'No';
    processedFormData['2-44649732/previous_funding_non_avalanche___seed'] = previousFunding.includes('Seed')
      ? 'Yes'
      : 'No';
    processedFormData['2-44649732/previous_funding_non_avalanche___series_a'] = previousFunding.includes('Series A')
      ? 'Yes'
      : 'No';

    // Handle similar project fields
    processedFormData['2-44649732/similar_project_name_1'] = (formData as any).similar_project_name_1 || 'N/A';
    processedFormData['2-44649732/similar_project_website_1'] = (formData as any).similar_project_website_1 || 'N/A';

    const fields = Object.entries(processedFormData).map(([name, value]) => {
      let formattedValue: any;
      if (Array.isArray(value)) {
        formattedValue = value.join(';');
      } else if (value instanceof Date) {
        formattedValue = value.toISOString().split('T')[0];
      } else {
        formattedValue = value;
      }
      return { name, value: formattedValue };
    });

    interface HubspotPayload {
      fields: { name: string; value: any }[];
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
        pageName: 'infraBUIDL Grant Application',
      },
    };

    if (formData.gdpr === true) {
      hubspotPayload.legalConsentOptions = {
        consent: {
          consentToProcess: true,
          text: 'I agree and authorize the Avalanche Foundation to utilize artificial intelligence systems to process the information in my application, any related material I provide and any related communications between me and the Avalanche Foundation, in order to assess the eligibility and suitability of my application and proposal.',
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
      const hubspotResponse = await fetch(
        `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_INFRABUIDL_FORM_GUID}`,
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

      if (!hubspotResponse.ok) {
        let hubspotResult: any;
        try {
          hubspotResult = await hubspotResponse.json();
        } catch {
          hubspotResult = { message: 'Could not read HubSpot response' };
        }
        throw new BadRequestError(hubspotResult?.message || 'Failed to submit to HubSpot');
      }

      return successResponse({ success: true });
    } finally {
      clearTimeout(timeoutId);
    }
  },
  { schema: infrabuidlSchema },
);
