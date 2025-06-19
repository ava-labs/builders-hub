import { NextResponse } from 'next/server';

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_PORTAL_ID = process.env.HUBSPOT_PORTAL_ID;
const HUBSPOT_INFRABUIDL_FORM_GUID = process.env.HUBSPOT_INFRABUIDL_FORM_GUID;

export async function POST(request: Request) {
  try {
    if (!HUBSPOT_API_KEY || !HUBSPOT_PORTAL_ID || !HUBSPOT_INFRABUIDL_FORM_GUID) {
      console.error('Missing environment variables: HUBSPOT_API_KEY, HUBSPOT_PORTAL_ID, or HUBSPOT_INFRABUIDL_FORM_GUID');
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
    
    const processedFormData: Record<string, any> = {};
    
    Object.entries(formData).forEach(([key, value]) => {
      if (['firstname', 'lastname', 'email', 'gdpr', 'marketing_consent'].includes(key)) {
        processedFormData[key] = value;
      } else {
        processedFormData[`2-44649732/${key}`] = value;
      }
    });
    
    processedFormData["2-44649732/project_type_ai"] = formData.project_type || "N/A";
    processedFormData["2-44649732/project_type_other"] = formData.project_type_other || "N/A";
    processedFormData["2-44649732/token_launch_other"] = formData.token_launch_other || "N/A";
    processedFormData["2-44649732/funding_round"] = formData.funding_round || "N/A";
    processedFormData["2-44649732/direct_competitor_1"] = formData.direct_competitor_1 || "N/A";
    processedFormData["2-44649732/applicant_job_role_other"] = formData.applicant_job_role_other || "N/A";
    processedFormData["2-44649732/avalanche_l1_project_benefited_1"] = formData.avalanche_l1_project_benefited_1 || "N/A";
    processedFormData["2-44649732/previous_avalanche_project_info"] = formData.previous_avalanche_project_info || "N/A";
    processedFormData["2-44649732/funding_amount"] = formData.funding_amount || "N/A";
    processedFormData["2-44649732/direct_competitor_1_website"] = formData.direct_competitor_1_website || "N/A";
    processedFormData["2-44649732/program_referrer"] = formData.program_referrer || "N/A";
    processedFormData["2-44649732/funding_entity"] = formData.funding_entity || "N/A";
    processedFormData["2-44649732/multichain_chains"] = formData.multichain_chains || "N/A";
    processedFormData["2-44649732/avalanche_l1_project_benefited_1_website"] = formData.avalanche_l1_project_benefited_1_website || "N/A";   
    processedFormData["2-44649732/applicant_first_name"] = formData.firstname;
    processedFormData["2-44649732/applicant_last_name"] = formData.lastname;
     
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
      fields: fields,
      context: {
        pageUri: request.headers.get('referer') || 'https://build.avax.network',
        pageName: 'infraBUIDL Grant Application'
      }
    };

    if (formData.gdpr === true) {
      hubspotPayload.legalConsentOptions = {
        consent: {
          consentToProcess: true,
          text: "I agree and authorize the Avalanche Foundation to utilize artificial intelligence systems to process the information in my application, any related material I provide and any related communications between me and the Avalanche Foundation, in order to assess the eligibility and suitability of my application and proposal.",
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
  
    console.log('HubSpot payload fields count:', hubspotPayload.fields.length);
    console.log('project_type_ai field:', processedFormData["2-44649732/project_type_ai"]);
    
    const hubspotResponse = await fetch(
      `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_INFRABUIDL_FORM_GUID}`,
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
    
    console.log('HubSpot response status:', hubspotResponse.status);
    console.log('HubSpot response:', hubspotResult);
    
    if (!hubspotResponse.ok) {
      return NextResponse.json(
        { 
          success: false, 
          status: responseStatus,
          response: hubspotResult
        },
        { status: responseStatus }
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