import { NextResponse } from 'next/server';

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_PORTAL_ID = process.env.HUBSPOT_PORTAL_ID;
const HUBSPOT_HACKATHON_FORM_GUID = process.env.HUBSPOT_HACKATHON_FORM_GUID;

export async function POST(request: Request) {
  try {
    if (!HUBSPOT_API_KEY || !HUBSPOT_PORTAL_ID || !HUBSPOT_HACKATHON_FORM_GUID) {
      console.error('Missing environment variables: HUBSPOT_API_KEY, HUBSPOT_PORTAL_ID, or HUBSPOT_HACKATHON_FORM_GUID');
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
    
    // Process the form data for HubSpot
    const processedFormData: Record<string, any> = {};
    
    // Map standard fields directly
    Object.entries(formData).forEach(([key, value]) => {
      if (['fullname', 'email', 'gdpr', 'marketing_consent'].includes(key)) {
        processedFormData[key] = value;
      } else {
        // Use custom property format for other fields
        processedFormData[`hackathon_${key}`] = value;
      }
    });
    
    // Map specific hackathon fields
    processedFormData["fullname"] = formData.name || "N/A";
    processedFormData["country_dropdown"] = formData.city || "N/A"; // use as country TODO: Rename city variable in dB
    processedFormData["hs_role"] = formData.role || "N/A";
    processedFormData["name"] = formData.company_name || ""; // To check if "name" is correct in HS form
    processedFormData["telegram_handle"] = formData.telegram_user || "";
    processedFormData["github_url"] = formData.github_portfolio || "";
    processedFormData["hackathon_interests"] = Array.isArray(formData.interests) ? formData.interests.join(";") : formData.interests || "";
    processedFormData["programming_language_familiarity"] = Array.isArray(formData.languages) ? formData.languages.join(";") : formData.languages || "";
    processedFormData["employment_role_other"] = Array.isArray(formData.roles) ? formData.roles.join(";") : formData.roles || "";
    processedFormData["tooling_familiarity"] = Array.isArray(formData.tools) ? formData.tools.join(";") : formData.tools || "";
    //processedFormData["hackathon_event_id"] = formData.hackathon_id || "";
    processedFormData["founder_check"] = "No";
    processedFormData["avalanche_ecosystem_member"] = "No";

    // Map boolean fields
    processedFormData["marketing_consent"] = formData.newsletter_subscription === true ? "Yes" : "No";
    processedFormData["gdpr"] = formData.terms_event_conditions === true ? "Yes" : "No";
    
    // Build HubSpot payload fields
    const fields: { name: string; value: string | boolean }[] = [];
    Object.entries(processedFormData).forEach(([name, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      
      let formattedValue: string | boolean = typeof value === 'string' || typeof value === 'boolean' ? value : String(value);
      
      fields.push({
        name: name,
        value: formattedValue
      });
    });

    interface HubspotPayload {
      fields: { name: string; value: string | boolean }[];
      context: {
        pageUri: string;
        pageName: string;
      };
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
      fields: fields,
      context: {
        pageUri: request.headers.get('referer') || 'https://build.avax.network',
        pageName: 'Hackathon Registration'
      }
    };

    // Add legal consent if GDPR is agreed to
    if (formData.gdpr === true) {
      hubspotPayload.legalConsentOptions = {
        consent: {
          consentToProcess: true,
          text: "I agree to allow Avalanche Foundation to store and process my personal data for hackathon participation purposes.",
          communications: [
            {
              value: formData.marketing_consent === true,
              subscriptionTypeId: 999,
              text: "I would like to receive marketing emails from the Avalanche Foundation."
            }
          ]
        }
      };
    }
  
    
    const hubspotResponse = await fetch(
      `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_HACKATHON_FORM_GUID}`,
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
      try {
        const text = await hubspotResponse.text();
        hubspotResult = { status: 'error', message: text };
      } catch (textError) {
        hubspotResult = { status: 'error', message: 'Could not read HubSpot response' };
      }
    }

    if (!hubspotResponse.ok) {
      throw new Error(`HubSpot API error: ${responseStatus} - ${JSON.stringify(hubspotResult)}`);
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Hackathon registration sent to HubSpot successfully',
      response: hubspotResult
    });

  } catch (error) {
    console.error('Error in hackathon-registration route:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to send registration to HubSpot',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}