import { NextResponse } from 'next/server';
import { getProject, createProject } from '@/server/services/projects';
import { GetProjectByIdWithMembers, UpdateStatusMember } from '@/server/services/memberProject';
import { createFormData } from '@/server/services/formData';
import { getUserById } from '@/server/services/getUser';

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
    } catch (error) {
      console.error('Error parsing request body:', error);
      return NextResponse.json(
        { success: false, message: 'Invalid request body' },
        { status: 400 }
      );
    }

    const projectId = formData.projectId;
    const userId = formData.userId;

    // Validate userId exists and is valid
    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'User ID is required' },
        { status: 401 }
      );
    }

    // Verify that the user exists in the database
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Invalid user ID' },
        { status: 401 }
      );
    }

    let finalProjectId = projectId;

    // Verify if project exists or create it
    if (projectId) {
      // Verify that the project exists in the database using service
      try {
        await getProject(projectId);
        finalProjectId = projectId;
        
        // If project exists, verify that the user is a member
        const projectWithMembers = await GetProjectByIdWithMembers(finalProjectId);
        
        if (!projectWithMembers) {
          return NextResponse.json(
            { success: false, message: 'Project not found' },
            { status: 404 }
          );
        }
        
        // Check if user is already a member
        const existingMember = projectWithMembers.members?.find(
          (member) => 
            (member.user_id === userId) &&
            member.status !== 'Removed'
        );
        
        if (!existingMember) {
          // User is not a member of the existing project - return error
          return NextResponse.json(
            { success: false, message: 'User is not a member of this project' },
            { status: 403 }
          );
        }
        
        // Update status if needed (user is already a member)
        if (existingMember.status !== 'Confirmed') {
          try {
            await UpdateStatusMember(
              userId,
              finalProjectId,
              'Confirmed',
              existingMember.email || formData.email || '',
              false // wasInOtherProject
            );
          } catch (error) {
            console.error('Error updating member status:', error);
            // Don't fail the request if status update fails, but log it
          }
        }
      } catch (error) {
        return NextResponse.json(
          { success: false, message: 'Project not found' },
          { status: 404 }
        );
      }
    } else {
      // Create new project if it doesn't exist
      try {
        const newProject = await createProject({
          project_name: formData.project,
          full_description: formData.project_abstract_objective || '',
          members: [{
            user_id: userId,
            role: 'Member',
            status: 'Confirmed',
          } as any],
          origin: "infrabuidl",
        });
        
        finalProjectId = newProject.id;
      } catch (error) {
        console.error('Error creating project:', error);
        return NextResponse.json(
          { success: false, message: 'Failed to create project' },
          { status: 500 }
        );
      }
    }

    // Save form data to database
    if (finalProjectId) {
      try {
        await createFormData({
          formData: formData,
          projectId: finalProjectId,
          origin: 'infrabuidl',
        });
      } catch (error) {
        console.error('Error saving form data:', error);
        // Don't fail the request if form data save fails, but log it
      }
    }
    
    const processedFormData: Record<string, any> = {};
    
    Object.entries(formData).forEach(([key, value]) => {
      if (['firstname', 'lastname', 'email', 'gdpr', 'marketing_consent'].includes(key)) {
        processedFormData[key] = value;
      } else {
        processedFormData[`2-44649732/${key}`] = value;
      }
    });
    
    // Handle conditional fields with defaults
    processedFormData["2-44649732/project_type_ai"] = formData.project_type || "N/A";
    processedFormData["2-44649732/project_type_other"] = formData.project_type_other || "N/A";
    processedFormData["2-44649732/token_launch_other"] = formData.token_launch_other || "N/A";
    processedFormData["2-44649732/direct_competitor_1"] = formData.direct_competitor_1 || "N/A";
    processedFormData["2-44649732/applicant_job_role_other"] = formData.applicant_job_role_other || "N/A";
    processedFormData["2-44649732/avalanche_l1_project_benefited_1"] = formData.avalanche_l1_project_benefited_1 || "N/A";
    processedFormData["2-44649732/previous_avalanche_project_info"] = formData.previous_avalanche_project_info || "N/A";
    processedFormData["2-44649732/direct_competitor_1_website"] = formData.direct_competitor_1_website || "N/A";
    processedFormData["2-44649732/program_referrer"] = formData.program_referrer || "N/A";
    processedFormData["2-44649732/multichain_chains"] = formData.multichain_chains || "N/A";
    processedFormData["2-44649732/avalanche_l1_project_benefited_1_website"] = formData.avalanche_l1_project_benefited_1_website || "N/A";   
    processedFormData["2-44649732/applicant_first_name"] = formData.firstname;
    processedFormData["2-44649732/applicant_last_name"] = formData.lastname;
    
    // Handle old field structure for backward compatibility
    processedFormData["2-44649732/funding_round"] = "N/A"; // Removed field
    processedFormData["2-44649732/funding_amount"] = "N/A"; // Removed field
    processedFormData["2-44649732/funding_entity"] = "N/A"; // Removed field
    processedFormData["2-44649732/requested_funding_range"] = formData.requested_funding_range_milestone || "N/A";
    
    // Handle new funding amount fields
    processedFormData["2-44649732/previous_funding_amount_codebase"] = formData.funding_amount_codebase || "0";
    processedFormData["2-44649732/previous_funding_amount_infrabuidl"] = formData.funding_amount_infrabuidl || "0";
    processedFormData["2-44649732/previous_funding_amount_infrabuidl_ai"] = formData.funding_amount_infrabuidl_ai || "0";
    processedFormData["2-44649732/retro9000_previous_funding_amount"] = formData.funding_amount_retro9000 || "0";
    processedFormData["2-44649732/previous_funding_amount_blizzard"] = formData.funding_amount_blizzard || "0";
    processedFormData["2-44649732/previous_funding_amount_ava_labs"] = formData.funding_amount_ava_labs || "0";
    processedFormData["2-44649732/previous_funding_amount_entity_other"] = formData.funding_amount_other_avalanche || "0";
    
    // Handle previous funding non-avalanche fields
    const previousFunding = Array.isArray(formData.previous_funding) ? formData.previous_funding : [formData.previous_funding];
    processedFormData["2-44649732/previous_funding_non_avalanche_grant"] = previousFunding.includes("Grant") ? "Yes" : "No";
    processedFormData["2-44649732/previous_funding_non_avalanche___angel_investment"] = previousFunding.includes("Angel Investment") ? "Yes" : "No";
    processedFormData["2-44649732/previous_funding_non_avalanche___pre_seed"] = previousFunding.includes("Pre-Seed") ? "Yes" : "No";
    processedFormData["2-44649732/previous_funding_non_avalanche___seed"] = previousFunding.includes("Seed") ? "Yes" : "No";
    processedFormData["2-44649732/previous_funding_non_avalanche___series_a"] = previousFunding.includes("Series A") ? "Yes" : "No";
    
    // Handle similar project fields
    processedFormData["2-44649732/similar_project_name_1"] = formData.similar_project_name_1 || "N/A";
    processedFormData["2-44649732/similar_project_website_1"] = formData.similar_project_website_1 || "N/A";
     
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
