import { z } from "zod";

export const formSchema = z.object({
  // Project Overview
  project: z.string().min(1, "Project name is required"),
  grant_program: z.string().min(1, "Grant program selection is required"),
  project_type: z.string().min(1, "Project type is required"),
  project_type_other: z.string().optional(),
  project_abstract_objective: z.string().min(10, "Please provide a more detailed project abstract"),
  technical_roadmap: z.string().min(10, "Please provide a more detailed technical roadmap"),
  repositories_achievements: z.string().min(10, "Please provide evidence of prior accomplishments"),
  risks_challenges: z.string().min(10, "Please provide key risks and challenges"),
  project_company_website: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  project_company_x_handle: z.string().optional(),
  project_company_github: z.string().min(1, "GitHub repository is required"),
  company_type: z.string().min(1, "Company type is required"),
  project_company_hq: z.string().min(1, "Project/Company HQ is required"),
  project_company_continent: z.string().min(1, "Project/Company continent is required"),
  project_company_logo: z.any().optional(),
  project_company_banner: z.any().optional(),
  media_kit: z.string().min(1, "Media Kit URL is required"),
  
  // Financial Overview
  previous_funding: z.array(z.string()).min(1, "At least one funding option must be selected"),
  funding_details: z.string().optional(),
  previous_avalanche_funding_grants: z.array(z.string()).min(1, "At least one option must be selected"),
  funding_amount_codebase: z.string().optional(),
  funding_amount_infrabuidl: z.string().optional(),
  funding_amount_infrabuidl_ai: z.string().optional(),
  funding_amount_retro9000: z.string().optional(),
  funding_amount_blizzard: z.string().optional(),
  funding_amount_ava_labs: z.string().optional(),
  funding_amount_other_avalanche: z.string().optional(),
  
  // Grant Budget Structure & Milestones
  requested_funding_range_milestone: z.string().min(1, "Funding range is required"),
  milestone_name_1: z.string().min(1, "Milestone name is required"),
  milestone_1_description: z.string().min(10, "Please provide a more detailed milestone description"),
  milestone_1_deliverables_kpi: z.string().min(10, "Please provide more detailed deliverables and KPIs"),
  milestone_1_completion_date: z.date({
    message: "Completion date is required",
  }),
  milestone_1_amount_requested: z.number().min(1, "Amount must be greater than 0"),
  
  milestone_name_2: z.string().min(1, "Milestone name is required"),
  milestone_2_description: z.string().min(10, "Please provide a more detailed milestone description"),
  milestone_2_deliverables_kpi: z.string().min(10, "Please provide more detailed deliverables and KPIs"),
  milestone_2_completion_date: z.date({
    message: "Completion date is required",
  }),
  milestone_2_amount_requested: z.number().min(1, "Amount must be greater than 0"),
  
  milestone_name_3: z.string().optional(),
  milestone_3_description: z.string().optional(),
  milestone_3_deliverables_kpi: z.string().optional(),
  milestone_3_completion_date: z.date().optional(),
  milestone_3_amount_requested: z.number().optional(),
  
  milestone_name_4: z.string().optional(),
  milestone_4_description: z.string().optional(),
  milestone_4_deliverables_kpi: z.string().optional(),
  milestone_4_completion_date: z.date().optional(),
  milestone_4_amount_requested: z.number().optional(),
  
  vc_fundraising_support_check: z.string().min(1, "Please select an option"),
  aethir_ai_gaming_fund_check: z.string().min(1, "Please select an option"),
  
  // Contribution to the Avalanche Ecosystem
  current_development_stage: z.string().min(1, "Development stage is required"),
  project_work_duration: z.string().min(1, "Work duration is required"),
  project_live_status: z.string().min(1, "Project live status is required"),
  multichain_check: z.string().min(1, "Please select an option"),
  multichain_chains: z.string().optional(),
  first_build_avalanche: z.string().min(1, "Please select an option"),
  previous_avalanche_project_info: z.string().optional(),
  avalanche_contribution: z.string().min(10, "Please provide more details about your contribution"),
  avalanche_benefit_check: z.string().min(1, "Please select an option"),
  avalanche_l1_project_benefited_1: z.string().optional(),
  avalanche_l1_project_benefited_1_website: z.string().optional(),
  avalanche_l1_project_benefited_2: z.string().optional(),
  avalanche_l1_project_benefited_2_website: z.string().optional(),
  similar_project_check: z.string().min(1, "Please select an option"),
  similar_project_name_1: z.string().optional(),
  similar_project_website_1: z.string().optional(),
  similar_project_name_2: z.string().optional(),
  similar_project_website_2: z.string().optional(),
  direct_competitor_check: z.string().min(1, "Please select an option"),
  direct_competitor_1: z.string().optional(),
  direct_competitor_1_website: z.string().optional(),
  direct_competitor_2: z.string().optional(),
  direct_competitor_2_website: z.string().optional(),
  token_launch_avalanche_check: z.string().min(1, "Please select an option"),
  token_launch_other: z.string().optional(),
  open_source_check: z.string().min(1, "Please select an option"),
  
  // Applicant Information
  firstname: z.string().min(1, "First name is required"),
  lastname: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  applicant_job_role: z.string().min(1, "Job role is required"),
  applicant_job_role_other: z.string().optional(),
  applicant_bio: z.string().min(10, "Please provide a more detailed bio"),
  applicant_country: z.string().optional(),
  university_affiliation: z.string().min(1, "Please select an option"),
  x_account: z.string().min(1, "X account is required"),
  telegram: z.string().min(1, "Telegram is required"),
  linkedin: z.string().optional(),
  github: z.string().optional(),
  other_resources: z.string().optional(),
  
  // Team Details
  team_size: z.string().min(1, "Team size is required"),
  
  // Team members (conditionally required based on team size)
  team_member_1_first_name: z.string().optional(),
  team_member_1_last_name: z.string().optional(),
  team_member_1_email: z.string().optional(),
  job_role_team_member_1: z.string().optional(),
  team_member_1_bio: z.string().optional(),
  team_member_1_x_account: z.string().optional(),
  team_member_1_telegram: z.string().optional(),
  team_member_1_linkedin: z.string().optional(),
  team_member_1_github: z.string().optional(),
  team_member_1_country: z.string().optional(),
  other_resource_s__team_member_1: z.string().optional(),
  
  team_member_2_first_name: z.string().optional(),
  team_member_2_last_name: z.string().optional(),
  team_member_2_email: z.string().optional(),
  job_role_team_member_2: z.string().optional(),
  team_member_2_bio: z.string().optional(),
  team_member_2_x_account: z.string().optional(),
  team_member_2_telegram: z.string().optional(),
  team_member_2_linkedin: z.string().optional(),
  team_member_2_github: z.string().optional(),
  team_member_2_country: z.string().optional(),
  other_resource_s__team_member_2: z.string().optional(),
  
  // Other
  kyb_willingness: z.string().min(1, "Please select an option"),
  avalanche_grant_source: z.string().min(1, "Please select an option"),
  avalanche_grant_source_other: z.string().optional(),
  program_referral_check: z.string().min(1, "Please select an option"),
  program_referrer: z.string().optional(),
  
  // Legal Compliance
  gdpr: z.boolean().refine(val => val === true, {
    message: "You must agree to the privacy policy to submit the form",
  }),
  marketing_consent: z.boolean().optional(),
});

export const jobRoles: string[] = [
  "Founder / Co-Founder",
  "Chief Executive Officer (CEO)",
  "Chief Technology Officer (CTO)",
  "Lead Developer / Senior Developer",
  "Smart Contract Developer",
  "Product Manager",
  "Community Manager",
  "Marketing Lead / Growth Lead",
  "Blockchain Engineer",
  "UX/UI Designer",
  "Other"
];

export const continents: string[] = [
  "Africa",
  "Asia",
  "Australia",
  "Europe",
  "North America",
  "South America"
];

export const countries: string[] = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", 
  "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", 
  "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
  "Canada", "China", "Denmark", "Egypt", "Finland", "France", "Germany", "Greece", "India", "Indonesia",
  "Ireland", "Israel", "Italy", "Japan", "Kenya", "Mexico", "Netherlands", "New Zealand", "Norway",
  "Portugal", "Russia", "Saudi Arabia", "Singapore", "South Africa", "South Korea", "Spain", "Sweden",
  "Switzerland", "Thailand", "Turkey", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Vietnam", "Other"
];