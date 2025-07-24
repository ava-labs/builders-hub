import { NextResponse } from 'next/server';

const HUBSPOT_API_KEY = process.env.HUBSPOT_API_KEY;
const HUBSPOT_PORTAL_ID = process.env.HUBSPOT_PORTAL_ID;
const RETRO9000_FORM_GUID = process.env.RETRO9000_FORM_GUID;

export async function POST(request: Request) {
  try {
    if (!HUBSPOT_API_KEY || !HUBSPOT_PORTAL_ID || !RETRO9000_FORM_GUID) {
      console.error('Missing environment variables: HUBSPOT_API_KEY, HUBSPOT_PORTAL_ID, or RETRO9000_FORM_GUID');
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
    const requiredFields = ['firstname', 'lastname', 'email', 'project', 'gdpr'];
    const missingFields = requiredFields.filter(field => !formData[field]);
    
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return NextResponse.json(
        { success: false, message: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      );
    }

    if (formData.gdpr !== true) {
      return NextResponse.json(
        { success: false, message: 'GDPR consent is required' },
        { status: 400 }
      );
    }

    const fieldMapping: { [key: string]: string[] } = {
      "project_name": ["2-44649732/project_name"],
      "firstname": ["2-44649732/applicant_first_name"],
      "lastname": ["2-44649732/applicant_last_name"],
      "email": ["email"],
      "x_account": ["2-44649732/x_account"],
      "telegram": ["2-44649732/telegram"],
      "linkedin": ["linkedin"],
      "other_resources": ["other_resources"],
      "applicant_job_role": ["2-44649732/applicant_job_role"],
      "applicant_job_role_other": ["2-44649732/applicant_job_role_other"],
      "applicant_bio": ["2-44649732/applicant_bio"],
      "university_affiliation": ["university_affiliated"],

      "project": ["2-44649732/project"],
      "project_type": ["2-43176573/project_type"],
      "project_vertical": ["project_vertical"],
      "project_vertical_other": ["project_vertical_other"],
      "project_abstract_objective": ["2-44649732/project_abstract_objective"],
      "technical_roadmap": ["2-44649732/technical_roadmap"],
      "repositories_achievements": ["2-44649732/repositories_achievements"],
      "risks_challenges": ["2-44649732/risks_challenges"],
      "project_company_website": ["project_company_website"],
      "project_company_x_handle": ["project_company_x_handle"],
      "project_company_github": ["2-44649732/project_company_github"],
      "company_type": ["2-44649732/company_type"],
      "company_type_other": ["2-44649732/company_type_other"],
      "project_company_hq": ["2-44649732/project_company_hq"],
      "project_company_continent": ["2-44649732/project_company_continent"],
      "media_kit": ["2-44649732/media_kit"],

      "previous_funding": ["2-44649732/previous_funding", "2-44649732/previous_funding_"],
      "funding_amount_self_funding": ["2-43176573/previous_funding_non_avalanche_self_funding"],
      "funding_amount_family_friends": ["2-43176573/previous_funding_non_avalanche_family_friends"],
      "funding_amount_grant": ["2-43176573/previous_funding_non_avalanche_grant"],
      "funding_amount_angel": ["2-43176573/previous_funding_non_avalanche_angel_investment"],
      "funding_amount_pre_seed": ["2-43176573/previous_funding_non_avalanche_pre_seed"],
      "funding_amount_seed": ["2-43176573/previous_funding_non_avalanche_seed"],
      "funding_amount_series_a": ["2-43176573/previous_funding_non_avalanche_series_a"],
      "previous_avalanche_funding_grants": ["2-44649732/previous_avalanche_funding_grants"],
      "funding_amount_codebase": ["2-44649732/previous_funding_amount_codebase"],
      "funding_amount_infrabuidl": ["2-44649732/previous_funding_amount_infrabuidl"],
      "funding_amount_infrabuidl_ai": ["2-44649732/previous_funding_amount_infrabuidl_ai"],
      "funding_amount_retro9000": ["funding_amount_retro9000"],
      "funding_amount_blizzard": ["2-44649732/previous_funding_amount_blizzard"],
      "funding_amount_avalabs": ["2-44649732/previous_funding_amount_ava_labs"],
      "funding_amount_other_avalanche": ["2-44649732/previous_funding_amount_entity_other"],
      "requested_funding_range": ["2-44649732/requested_funding_range"],

      "eligibility_and_metrics": ["2-44649732/retro9000_eligibility"],
      "requested_grant_size_budget": ["2-44649732/requested_grant_size_and_budget"],
      "previous_retro9000_funding": ["previous_retro9000_funding"],
      "retro9000_previous_funding_amount": ["2-44649732/retro9000_previous_funding_amount"],
      "retro9000_changes": ["2-44649732/post_retro9000_funding_changes"],
      "vc_fundraising_support_check": ["2-44649732/vc_fundraising_support_check"],

      "current_development_stage": ["2-44649732/current_development_stage"],
      "project_work_duration": ["2-44649732/project_work_duration"],
      "project_live_status": ["2-44649732/project_live_status"],
      "multichain_check": ["2-44649732/multichain_check"],
      "multichain_chains": ["2-44649732/multichain_chains"],
      "first_build_avalanche": ["2-44649732/first_build_avalanche"],
      "previous_avalanche_project_info": ["2-44649732/previous_avalanche_project_info"],
      "avalanche_contribution": ["2-44649732/avalanche_contribution"],
      "avalanche_benefit_check": ["2-44649732/avalanche_benefit_check"],
      "avalanche_l1_project_benefited_1_name": ["2-44649732/avalanche_l1_project_benefited_1"],
      "avalanche_l1_project_benefited_1_website": ["2-44649732/avalanche_l1_project_benefited_1_website"],
      "avalanche_l1_project_benefited_2_name": ["avalanche_l1_project_benefited_2_name"],
      "avalanche_l1_project_benefited_2_website": ["avalanche_l1_project_benefited_2_website"],
      "similar_project_check": ["2-44649732/similar_project_check"],
      "similar_project_name_1": ["2-44649732/similar_project_name_1"],
      "similar_project_website_1": ["2-44649732/similar_project_website_1"],
      "similar_project_name_2": ["similar_project_name_2"],
      "similar_project_website_2": ["similar_project_website_2"],
      "direct_competitor_check": ["2-44649732/direct_competitor_check"],
      "direct_competitor_1_name": ["2-44649732/direct_competitor_1"],
      "direct_competitor_1_website": ["2-44649732/direct_competitor_1_website"],
      "direct_competitor_2_name": ["direct_competitor_2_name"],
      "direct_competitor_2_website": ["direct_competitor_2_website"],
      "token_launch_avalanche_check": ["2-44649732/token_launch_avalanche_check"],
      "token_launch_other_explanation": ["2-44649732/token_launch_other"],
      "open_source_check": ["2-44649732/open_source_check"],

      "team_size": ["2-44649732/team_size"],
      "team_member_1_first_name": ["team_member_1_first_name"],
      "team_member_1_last_name": ["team_member_1_last_name"],
      "team_member_1_email": ["team_member_1_email"],
      "job_role_team_member_1": ["job_role_team_member_1"],
      "team_member_1_x_account": ["team_member_1_x_account"],
      "team_member_1_telegram": ["team_member_1_telegram"],
      "team_member_1_linkedin": ["team_member_1_linkedin"],
      "team_member_1_github": ["team_member_1_github"],
      "team_member_1_other": ["team_member_1_other"],
      "team_member_1_bio": ["team_member_1_bio"],
      "team_member_2_first_name": ["team_member_2_first_name"],
      "team_member_2_last_name": ["team_member_2_last_name"],
      "team_member_2_email": ["team_member_2_email"],
      "job_role_team_member_2": ["job_role_team_member_2"],
      "team_member_2_x_account": ["team_member_2_x_account"],
      "team_member_2_telegram": ["team_member_2_telegram"],
      "team_member_2_linkedin": ["team_member_2_linkedin"],
      "team_member_2_github": ["team_member_2_github"],
      "team_member_2_other": ["team_member_2_other"],
      "team_member_2_bio": ["team_member_2_bio"],

      "avalanche_grant_source": ["2-44649732/avalanche_grant_source"],
      "avalanche_grant_source_other": ["avalanche_grant_source_other"],
      "program_referral_check": ["2-44649732/program_referral_check"],
      "program_referrer": ["2-44649732/program_referrer"],

      "kyb_willing": ["kyb_willing"],
      "gdpr": ["gdpr"],
      "marketing_consent": ["marketing_consent"]
    };
    
    const fields: { name: string; value: string | boolean }[] = [];
    
    Object.keys(fieldMapping).forEach(formFieldName => {
      const value = formData[formFieldName];
      let formattedValue: string | boolean;
      
      if (Array.isArray(value)) {
        formattedValue = value ? value.filter(v => v !== null && v !== undefined && v !== '').join(', ') : '';
      } else if (typeof value === 'boolean') {
        if (formFieldName !== 'gdpr' && formFieldName !== 'marketing_consent') {
          formattedValue = value ? 'Yes' : 'No';
        } else {
          formattedValue = value;
        }
      } else {
        if (value === undefined || value === null || value === '') {
          const mappedFields = fieldMapping[formFieldName];
          const isAmountField = mappedFields.some(field => 
            field.includes('amount') || field.includes('funding')
          );
          formattedValue = isAmountField ? '0' : 'N/A';
        } else {
          formattedValue = String(value);
        }
      }

      const mappedFields = fieldMapping[formFieldName];
      mappedFields.forEach(fieldName => {
        fields.push({
          name: fieldName,
          value: formattedValue
        });
      });
    });
    
    const additionalRequiredFields = [
      { name: "2-44649732/previous_funding_amount_infrabuidl", value: "0" },
      { name: "2-43176573/previous_funding_non_avalanche_angel_investment", value: "0" },
      { name: "2-44649732/token_launch_other", value: "N/A" },
      { name: "2-44649732/similar_project_name_1", value: "N/A" },
      { name: "2-44649732/similar_project_website_1", value: "N/A" },
      { name: "2-44649732/direct_competitor_1", value: "N/A" },
      { name: "2-44649732/previous_funding_amount_entity_other", value: "0" },
      { name: "2-43176573/previous_funding_non_avalanche_pre_seed", value: "0" },
      { name: "2-44649732/applicant_job_role_other", value: "N/A" },
      { name: "2-44649732/avalanche_l1_project_benefited_1", value: "N/A" },
      { name: "2-44649732/previous_funding_amount_blizzard", value: "0" },
      { name: "2-44649732/previous_avalanche_project_info", value: "N/A" },
      { name: "2-44649732/previous_funding_amount_infrabuidl_ai", value: "0" },
      { name: "2-44649732/direct_competitor_1_website", value: "N/A" },
      { name: "2-43176573/previous_funding_non_avalanche_seed", value: "0" },
      { name: "2-44649732/program_referrer", value: "N/A" },
      { name: "2-43176573/previous_funding_non_avalanche_grant", value: "0" },
      { name: "2-44649732/avalanche_l1_project_benefited_1_website", value: "N/A" },
      { name: "2-44649732/previous_funding_amount_ava_labs", value: "0" },
      { name: "2-43176573/previous_funding_non_avalanche_series_a", value: "0" },
      { name: "2-43176573/previous_funding_non_avalanche_self_funding", value: "0" },
      { name: "2-43176573/previous_funding_non_avalanche_family_friends", value: "0" }
    ];
    
    additionalRequiredFields.forEach(field => {
      if (!fields.find(f => f.name === field.name)) {
        fields.push({
          name: field.name,
          value: field.value
        });
      }
    });
    Object.entries(formData).forEach(([name, value]) => {
      if (!fieldMapping[name] && value !== undefined && value !== null && value !== '') {
        let formattedValue: string | boolean;
        
        if (Array.isArray(value)) {
          formattedValue = value.filter(v => v !== null && v !== undefined && v !== '').join(', ');
        } else if (typeof value === 'boolean') {
          formattedValue = value ? 'Yes' : 'No';
        } else {
          formattedValue = String(value);
        }
        
        fields.push({
          name: name,
          value: formattedValue
        });
      }
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
        pageName: 'Retro9000 Grant Application'
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
      `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${RETRO9000_FORM_GUID}`,
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
        hubspotResult = { status: 'error', message: text };
      }
    } catch (error) {
      hubspotResult = { status: 'error', message: 'Could not read HubSpot response' };
    }
    
    if (!hubspotResponse.ok) {
      console.error('HubSpot submission failed:', {
        status: responseStatus,
        response: hubspotResult
      });
      return NextResponse.json(
        { 
          success: false, 
          message: 'Failed to submit to HubSpot',
          status: responseStatus,
          response: hubspotResult
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Application submitted successfully' 
    });
  } catch (error) {
    console.error('Error processing form submission:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}