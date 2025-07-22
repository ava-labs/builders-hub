"use client"
import { ReactNode, useState, useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Loader2, CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { formSchema, jobRoles, continents, countries } from "@/types/infrabuidlForm"

type FormValues = z.infer<typeof formSchema>;

interface GrantApplicationFormProps {
  programType: "infraBUIDL()" | "infraBUIDL(AI)";
  headerComponent: ReactNode;
}

export default function GrantApplicationForm({ programType, headerComponent }: GrantApplicationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showTeamMembers, setShowTeamMembers] = useState<boolean>(false);
  const [showProjectTypeOther, setShowProjectTypeOther] = useState<boolean>(false);
  const [showJobRoleOther, setShowJobRoleOther] = useState<boolean>(false);
  const [showFundingDetails, setShowFundingDetails] = useState<boolean>(false);
  const [showMultichainDetails, setShowMultichainDetails] = useState<boolean>(false);
  const [showPreviousProjectDetails, setShowPreviousProjectDetails] = useState<boolean>(false);
  const [showBenefitDetails, setShowBenefitDetails] = useState<boolean>(false);
  const [showSimilarProjects, setShowSimilarProjects] = useState<boolean>(false);
  const [showCompetitors, setShowCompetitors] = useState<boolean>(false);
  const [showTokenLaunchDetails, setShowTokenLaunchDetails] = useState<boolean>(false);
  const [showReferrer, setShowReferrer] = useState<boolean>(false);
  const [showGrantSource, setShowGrantSource] = useState<boolean>(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      grant_program: programType,
      
      // Project Overview defaults
      project: "",
      project_type: "",
      project_type_other: "",
      project_abstract_objective: "",
      technical_roadmap: "",
      repositories_achievements: "",
      risks_challenges: "",
      project_company_website: "",
      project_company_x_handle: "",
      project_company_github: "",
      company_type: "",
      project_company_hq: "",
      project_company_continent: "",
      media_kit: "",
      
      // Financial Overview defaults
      previous_funding: [],
      funding_entity: "",
      funding_amount: "",
      funding_round: "",
      previous_avalanche_funding_grants: [],
      requested_funding_range: "",
      
      // Grant Budget Structure & Milestones defaults
      upfront_payment_requested: 0,
      milestone_name_1: "",
      milestone_1_description: "",
      milestone_1_deliverables_kpi: "",
      milestone_1_amount_requested: 0,
      
      milestone_name_2: "",
      milestone_2_description: "",
      milestone_2_deliverables_kpi: "",
      milestone_2_amount_requested: 0,
      
      milestone_name_3: "",
      milestone_3_description: "",
      milestone_3_deliverables_kpi: "",
      milestone_3_amount_requested: 0,
      
      milestone_name_4: "",
      milestone_4_description: "",
      milestone_4_deliverables_kpi: "",
      milestone_4_amount_requested: 0,
      
      vc_fundraising_support_check: "",
      aethir_ai_gaming_fund_check: "",
      
      // Contribution to the Avalanche Ecosystem defaults
      current_development_stage: "",
      project_work_duration: "",
      project_live_status: "",
      multichain_check: "",
      multichain_chains: "",
      first_build_avalanche: "",
      previous_avalanche_project_info: "",
      avalanche_contribution: "",
      avalanche_benefit_check: "",
      avalanche_l1_project_benefited_1: "",
      avalanche_l1_project_benefited_1_website: "",
      avalanche_l1_project_benefited_2: "",
      avalanche_l1_project_benefited_2_website: "",
      similar_project_check: "",
      similar_project_name_1: "",
      similar_project_website_1: "",
      similar_project_name_2: "",
      similar_project_website_2: "",
      direct_competitor_check: "",
      direct_competitor_1: "",
      direct_competitor_1_website: "",
      direct_competitor_2: "",
      direct_competitor_2_website: "",
      token_launch_avalanche_check: "",
      token_launch_other: "",
      open_source_check: "",
      
      // Applicant Information defaults
      firstname: "",
      lastname: "",
      email: "",
      applicant_job_role: "",
      applicant_job_role_other: "",
      applicant_bio: "",
      applicant_country: "",
      x_account: "",
      telegram: "",
      linkedin: "",
      github: "",
      other_resources: "",
      
      // Team Details defaults
      team_size: "",
      
      // Team Member 1 defaults
      team_member_1_first_name: "",
      team_member_1_last_name: "",
      team_member_1_email: "",
      job_role_team_member_1: "",
      team_member_1_bio: "",
      team_member_1_x_account: "",
      team_member_1_telegram: "",
      team_member_1_linkedin: "",
      team_member_1_github: "",
      team_member_1_country: "",
      other_resource_s__team_member_1: "",
      
      // Team Member 2 defaults
      team_member_2_first_name: "",
      team_member_2_last_name: "",
      team_member_2_email: "",
      job_role_team_member_2: "",
      team_member_2_bio: "",
      team_member_2_x_account: "",
      team_member_2_telegram: "",
      team_member_2_linkedin: "",
      team_member_2_github: "",
      team_member_2_country: "",
      other_resource_s__team_member_2: "",
      
      // Other defaults
      avalanche_grant_source: "",
      avalanche_grant_source_other: "",
      program_referral_check: "",
      program_referrer: "",
      
      // Legal Compliance defaults
      gdpr: false,
      marketing_consent: false,
    }
  });

  // Watch form values for conditional rendering
  const watchTeamSize = form.watch("team_size");
  const watchProjectType = form.watch("project_type");
  const watchApplicantJobRole = form.watch("applicant_job_role");
  const watchPreviousFunding = form.watch("previous_funding");
  const watchMultichainCheck = form.watch("multichain_check");
  const watchFirstBuildAvalanche = form.watch("first_build_avalanche");
  const watchAvalancheBenefitCheck = form.watch("avalanche_benefit_check");
  const watchSimilarProjectCheck = form.watch("similar_project_check");
  const watchDirectCompetitorCheck = form.watch("direct_competitor_check");
  const watchTokenLaunchCheck = form.watch("token_launch_avalanche_check");
  const watchGrantSource = form.watch("avalanche_grant_source");
  const watchReferralCheck = form.watch("program_referral_check");

  useEffect(() => {
    setShowTeamMembers(watchTeamSize !== "1" && watchTeamSize !== "");
    setShowProjectTypeOther(watchProjectType === "Other");
    setShowJobRoleOther(watchApplicantJobRole === "Other");
    setShowGrantSource(watchGrantSource === "Other");
    
    const fundingTypes = ["Grant", "Angel Investment", "Pre-Seed", "Seed", "Series A"];
    setShowFundingDetails(watchPreviousFunding.some(type => fundingTypes.includes(type)));
    
    setShowMultichainDetails(watchMultichainCheck === "Yes");
    setShowPreviousProjectDetails(watchFirstBuildAvalanche === "No");
    setShowBenefitDetails(watchAvalancheBenefitCheck === "Yes");
    setShowSimilarProjects(watchSimilarProjectCheck === "Yes");
    setShowCompetitors(watchDirectCompetitorCheck === "Yes");
    setShowTokenLaunchDetails(watchTokenLaunchCheck === "No");
    setShowReferrer(watchReferralCheck === "Yes");
    
  }, [
    watchTeamSize,
    watchProjectType,
    watchApplicantJobRole,
    watchPreviousFunding,
    watchMultichainCheck,
    watchFirstBuildAvalanche,
    watchAvalancheBenefitCheck,
    watchSimilarProjectCheck,
    watchDirectCompetitorCheck,
    watchTokenLaunchCheck,
    watchGrantSource,
    watchReferralCheck
  ]);

  // Function to handle form submission
  async function onSubmit(values: FormValues) {
    setIsSubmitting(true);
    console.log('Form values:', values);
    
    try {
      const submissionData = {
        ...values,
        grant_program: programType,
        project_company_logo: "N/A",
        project_company_banner: "N/A",
      };
      
      const hubspotFormData: Record<string, string | number | boolean> = {};
      Object.entries(submissionData).forEach(([key, value]) => {
        if ((value === "" || value === null || value === undefined) && 
            key !== "firstname" && 
            key !== "email" && 
            !key.includes("required")) {
          return;
        }

        if (Array.isArray(value)) {
          hubspotFormData[key] = value.join(";");
        }
        else if (value instanceof Date) {
          hubspotFormData[key] = format(value, "yyyy-MM-dd");
        }
        else if (typeof value === 'boolean') {
          if (key === 'gdpr' || key === 'marketing_consent') {
            hubspotFormData[key] = value;
          } else {
            hubspotFormData[key] = value ? "Yes" : "No";
          }
        } 
        else {
          hubspotFormData[key] = value;
        }
      });
      
      console.log("HubSpot form data prepared for submission:", hubspotFormData);
      const response = await fetch('/api/infrabuidl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(hubspotFormData)
      });

      console.log("API Response status:", response.status);
      const result = await response.json();
      console.log("API Response data:", result);

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to submit to HubSpot');
      }

      setSubmissionStatus('success');
      alert("Your grant application has been successfully submitted!");
      form.reset();
      form.setValue("grant_program", programType);    
    } catch (error) {
      setSubmissionStatus('error');
      alert(`Error submitting application: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      {headerComponent}
      
      {submissionStatus === 'success' ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <h2 className="text-2xl font-semibold text-green-800 mb-4">Application Submitted Successfully!</h2>
          <p className="text-green-700 mb-6">Thank you for applying to the {programType} grant program. We will review your application and get back to you soon.</p>
          <Button 
            onClick={() => {
              setSubmissionStatus('idle');
              form.reset();
              form.setValue("grant_program", programType);
            }}
            className="bg-green-600 hover:bg-green-700"
          >
            Submit Another Application
          </Button>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Project Overview */}
            <div className="bg-white dark:bg-black rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 mb-8">
              <div className="space-y-1 mb-6">
                <h2 className="text-2xl text-gray-900 dark:text-gray-100">Project Overview</h2>
              </div>
              
              <div className="space-y-6">
                {/* Project/Company Name */}
                <FormField
                  control={form.control}
                  name="project"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Project/Company Name <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                          placeholder="Enter your project or company name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                <input type="hidden" name="grant_program" value={programType} />               
                <FormField
                  control={form.control}
                  name="project_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Project Type <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(value) => {
                            field.onChange(value);
                            setShowProjectTypeOther(value === "Other");
                          }}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          {programType === "infraBUIDL()" ? (
                            <>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Validator Marketplaces" id="validator-marketplaces" />
                                <label htmlFor="validator-marketplaces">Validator Marketplaces</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Virtual Machines" id="virtual-machines" />
                                <label htmlFor="virtual-machines">Virtual Machines</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Wallets" id="wallets" />
                                <label htmlFor="wallets">Wallets</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Oracles" id="oracles" />
                                <label htmlFor="oracles">Oracles</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Interoperability Tools" id="interoperability-tools" />
                                <label htmlFor="interoperability-tools">Interoperability Tools</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Cryptography" id="cryptography" />
                                <label htmlFor="cryptography">Cryptography</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Bridges" id="bridges" />
                                <label htmlFor="bridges">Bridges</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Explorers" id="explorers" />
                                <label htmlFor="explorers">Explorers</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="RPCs" id="rpcs" />
                                <label htmlFor="rpcs">RPCs</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Data Storage" id="data-storage" />
                                <label htmlFor="data-storage">Data Storage</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Indexers" id="indexers" />
                                <label htmlFor="indexers">Indexers</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Token Engineering" id="token-engineering" />
                                <label htmlFor="token-engineering">Token Engineering</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="On & Offramps" id="on-offramps" />
                                <label htmlFor="on-offramps">On & Offramps</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Other" id="other" />
                                <label htmlFor="other">Other</label>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Autonomous Chat Agents" id="autonomous-chat-agents" />
                                <label htmlFor="autonomous-chat-agents">Autonomous Chat Agents</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Meme Agents" id="meme-agents" />
                                <label htmlFor="meme-agents">Meme Agents</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Social and Influencer Agents" id="social-influencer-agents" />
                                <label htmlFor="social-influencer-agents">Social and Influencer Agents</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Agents Infra" id="agents-infra" />
                                <label htmlFor="agents-infra">Agents Infra</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Agent Token Tooling" id="agent-token-tooling" />
                                <label htmlFor="agent-token-tooling">Agent Token Tooling</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="DeFi Agents" id="defi-agents" />
                                <label htmlFor="defi-agents">DeFi Agents</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Trading Agents" id="trading-agents" />
                                <label htmlFor="trading-agents">Trading Agents</label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Other" id="other" />
                                <label htmlFor="other">Other</label>
                              </div>
                            </>
                          )}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                {/* Project Type Other */}
                {showProjectTypeOther && (
                  <FormField
                    control={form.control}
                    name="project_type_other"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="dark:text-gray-200 text-md">
                          If you chose "Other," please share your project's type below <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                            placeholder="E.g., RWA"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="dark:text-red-400" />
                      </FormItem>
                    )}
                  />
                )}
                
                {/* Project Abstract and Objective */}
                <FormField
                  control={form.control}
                  name="project_abstract_objective"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Project Abstract and Objective <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormDescription>
                        Please tell us more about the project and clearly state its primary objectives and key use cases. Explain how the solution enhances Avalanche's capabilities and why it's well-suited for emerging market conditions.
                      </FormDescription>
                      <FormControl>
                        <Textarea
                          className="min-h-[150px] border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                          placeholder="Describe your project, its objectives, and key use cases..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                {/* Technical Roadmap */}
                <FormField
                  control={form.control}
                  name="technical_roadmap"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Technical Roadmap <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormDescription>
                        Please include a technical roadmap to outline the various development stages involved in the project. This roadmap should provide a clear timeline, specifying the expected start and end dates for each stage, as well as the key activities that will be undertaken during each phase.
                      </FormDescription>
                      <FormControl>
                        <Textarea
                          className="min-h-[150px] border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                          placeholder="Outline your technical roadmap with timelines and key activities..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                {/* Repositories and Achievements */}
                <FormField
                  control={form.control}
                  name="repositories_achievements"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Repositories and Achievements <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormDescription>
                        Provide evidence of prior accomplishments in blockchain infrastructure and tooling, blockchain software, AI tooling or related fields.
                      </FormDescription>
                      <FormControl>
                        <Textarea
                          className="min-h-[150px] border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                          placeholder="List your repositories and achievements in blockchain or AI fields..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                {/* Risks and Challenges */}
                <FormField
                  control={form.control}
                  name="risks_challenges"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Risks and Challenges <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormDescription>
                        Please provide key risks (technical, regulatory, market, etc.), potential roadblocks and contingency plans.
                      </FormDescription>
                      <FormControl>
                        <Textarea
                          className="min-h-[150px] border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                          placeholder="Describe the risks, challenges, and contingency plans for your project..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                {/* Project/Company Website */}
                <FormField
                  control={form.control}
                  name="project_company_website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Project/Company Website
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                          placeholder="https://yourwebsite.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                {/* Project/Company X Handle */}
                <FormField
                  control={form.control}
                  name="project_company_x_handle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Project/Company X Handle
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                          placeholder="@yourhandle"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                {/* Project/Company GitHub */}
                <FormField
                  control={form.control}
                  name="project_company_github"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Project/Company GitHub <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                          placeholder="https://github.com/your-project"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                {/* Company Type */}
                <FormField
                  control={form.control}
                  name="company_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Company Type <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="No Registered Entity" id="no-registered-entity" />
                            <label htmlFor="no-registered-entity">No Registered Entity</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Solo Developer" id="solo-developer" />
                            <label htmlFor="solo-developer">Solo Developer</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Independent Development Team" id="independent-development-team" />
                            <label htmlFor="independent-development-team">Independent Development Team</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="DAO" id="dao" />
                            <label htmlFor="dao">DAO</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Private Company" id="private-company" />
                            <label htmlFor="private-company">Private Company</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Public Company" id="public-company" />
                            <label htmlFor="public-company">Public Company</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Not for Profit" id="not-for-profit" />
                            <label htmlFor="not-for-profit">Not for Profit</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Other" id="company-type-other" />
                            <label htmlFor="company-type-other">Other</label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                {/* Project/Company HQ */}
                <FormField
                  control={form.control}
                  name="project_company_hq"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Project/Company HQ <span className="text-red-500">*</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100">
                            <SelectValue placeholder="Select country" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                          {countries.map((country) => (
                            <SelectItem key={country} value={country} className="dark:text-gray-200">
                              {country}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                {/* Project/Company Continent */}
                <FormField
                  control={form.control}
                  name="project_company_continent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Project/Company Continent <span className="text-red-500">*</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100">
                            <SelectValue placeholder="Select continent" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                          {continents.map((continent) => (
                            <SelectItem key={continent} value={continent} className="dark:text-gray-200">
                              {continent}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />

                {/* Project/Company Logo - HIDDEN FOR NOW */}
                <input type="hidden" name="project_company_logo" value="N/A" />

                {/* Project/Company Banner - HIDDEN FOR NOW */}
                <input type="hidden" name="project_company_banner" value="N/A" />
                
                {/* Media Kit */}
                <FormField
                  control={form.control}
                  name="media_kit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Media Kit <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormDescription>
                        Please share a Google Drive folder link for your brand guidelines, logos, and video/static assets that can be used in social content. Ensure the folder is accessible to anyone with the link.
                      </FormDescription>
                      <FormControl>
                        <Input
                          className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                          placeholder="https://drive.google.com/drive/folders/your-folder-id"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            {/* Financial Overview */}
            <div className="bg-white dark:bg-black rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 mb-8">
              <div className="space-y-1 mb-6">
                <h2 className="text-2xl text-gray-900 dark:text-gray-100">Financial Overview</h2>
              </div>
              
              <div className="space-y-6">
                {/* Previous Funding */}
                <FormField
                  control={form.control}
                  name="previous_funding"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Previous Funding <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormDescription>
                        If you choose 'Grant,' 'Angel Investment,' 'Pre-Seed,' 'Seed,' or 'Series A,' you will be prompted to list the entity, amount, and funding round.
                      </FormDescription>
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="no-funding"
                            checked={field.value.includes("No Funding")}
                            onCheckedChange={(checked) => {
                              const newValue = checked
                                ? [...field.value, "No Funding"]
                                : field.value.filter((v) => v !== "No Funding");
                              field.onChange(newValue);
                            }}
                            className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800"
                          />
                          <label htmlFor="no-funding" className="text-sm font-medium leading-none">
                            No Funding
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="self-funding"
                            checked={field.value.includes("Self-Funding")}
                            onCheckedChange={(checked) => {
                              const newValue = checked
                                ? [...field.value, "Self-Funding"]
                                : field.value.filter((v) => v !== "Self-Funding");
                              field.onChange(newValue);
                            }}
                            className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800"
                          />
                          <label htmlFor="self-funding" className="text-sm font-medium leading-none">
                            Self-Funding
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="family-friends"
                            checked={field.value.includes("Family & Friends")}
                            onCheckedChange={(checked) => {
                              const newValue = checked
                                ? [...field.value, "Family & Friends"]
                                : field.value.filter((v) => v !== "Family & Friends");
                              field.onChange(newValue);
                            }}
                            className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800"
                          />
                          <label htmlFor="family-friends" className="text-sm font-medium leading-none">
                            Family & Friends
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="grant"
                            checked={field.value.includes("Grant")}
                            onCheckedChange={(checked) => {
                              const newValue = checked
                                ? [...field.value, "Grant"]
                                : field.value.filter((v) => v !== "Grant");
                              field.onChange(newValue);
                            }}
                            className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800"
                          />
                          <label htmlFor="grant" className="text-sm font-medium leading-none">
                            Grant
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="angel-investment"
                            checked={field.value.includes("Angel Investment")}
                            onCheckedChange={(checked) => {
                              const newValue = checked
                                ? [...field.value, "Angel Investment"]
                                : field.value.filter((v) => v !== "Angel Investment");
                              field.onChange(newValue);
                            }}
                            className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800"
                          />
                          <label htmlFor="angel-investment" className="text-sm font-medium leading-none">
                            Angel Investment
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="pre-seed"
                            checked={field.value.includes("Pre-Seed")}
                            onCheckedChange={(checked) => {
                              const newValue = checked
                                ? [...field.value, "Pre-Seed"]
                                : field.value.filter((v) => v !== "Pre-Seed");
                              field.onChange(newValue);
                            }}
                            className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800"
                          />
                          <label htmlFor="pre-seed" className="text-sm font-medium leading-none">
                            Pre-Seed
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="seed"
                            checked={field.value.includes("Seed")}
                            onCheckedChange={(checked) => {
                              const newValue = checked
                                ? [...field.value, "Seed"]
                                : field.value.filter((v) => v !== "Seed");
                              field.onChange(newValue);
                            }}
                            className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800"
                          />
                          <label htmlFor="seed" className="text-sm font-medium leading-none">
                            Seed
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="series-a"
                            checked={field.value.includes("Series A")}
                            onCheckedChange={(checked) => {
                              const newValue = checked
                                ? [...field.value, "Series A"]
                                : field.value.filter((v) => v !== "Series A");
                              field.onChange(newValue);
                            }}
                            className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800"
                          />
                          <label htmlFor="series-a" className="text-sm font-medium leading-none">
                            Series A
                          </label>
                        </div>
                      </div>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                {/* Funding Details (conditional) */}
                {showFundingDetails && (
                  <div className="space-y-6 border-l-2 border-gray-200 pl-4 dark:border-gray-700">
                    <FormField
                      control={form.control}
                      name="funding_entity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-gray-200 text-md">
                            Funding Entity <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                              placeholder="Enter the name of the funding entity"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="funding_amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-gray-200 text-md">
                            Funding Amount <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                              placeholder="Enter the funding amount (e.g., $100,000)"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="funding_round"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-gray-200 text-md">
                            Funding Round <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                              placeholder="Enter the funding round details"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
                
                {/* Previous Avalanche Funding/Grants */}
                <FormField
                  control={form.control}
                  name="previous_avalanche_funding_grants"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Previous Avalanche Funding/Grants <span className="text-red-500">*</span>
                      </FormLabel>
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="codebase"
                            checked={field.value.includes("Codebase")}
                            onCheckedChange={(checked) => {
                              const newValue = checked
                                ? [...field.value, "Codebase"]
                                : field.value.filter((v) => v !== "Codebase");
                              field.onChange(newValue);
                            }}
                            className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800"
                          />
                          <label htmlFor="codebase" className="text-sm font-medium leading-none">
                            Codebase
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="infrabuildl"
                            checked={field.value.includes("infraBUIDL()")}
                            onCheckedChange={(checked) => {
                              const newValue = checked
                                ? [...field.value, "infraBUIDL()"]
                                : field.value.filter((v) => v !== "infraBUIDL()");
                              field.onChange(newValue);
                            }}
                            className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800"
                          />
                          <label htmlFor="infrabuildl" className="text-sm font-medium leading-none">
                            infraBUIDL()
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="infrabuildl-ai"
                            checked={field.value.includes("infraBUIDL(AI)")}
                            onCheckedChange={(checked) => {
                              const newValue = checked
                                ? [...field.value, "infraBUIDL(AI)"]
                                : field.value.filter((v) => v !== "infraBUIDL(AI)");
                              field.onChange(newValue);
                            }}
                            className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800"
                          />
                          <label htmlFor="infrabuildl-ai" className="text-sm font-medium leading-none">
                            infraBUIDL(AI)
                          </label>
                        </div>
                      </div>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                {/* Requested Funding Range */}
                <FormField
                  control={form.control}
                  name="requested_funding_range"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Requested Funding Range <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="$1 - $24,999" id="1-24999" />
                            <label htmlFor="1-24999">$1 - $24,999</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="$25,000 - $49,999" id="25000-49999" />
                            <label htmlFor="25000-49999">$25,000 - $49,999</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="$50,000 - $99,999" id="50000-99999" />
                            <label htmlFor="50000-99999">$50,000 - $99,999</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="$100,000 - $199,999" id="100000-199999" />
                            <label htmlFor="100000-199999">$100,000 - $199,999</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="$200,000+" id="200000-plus" />
                            <label htmlFor="200000-plus">$200,000+</label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            {/* Grant Budget Structure & Milestones */}
            <div className="bg-white dark:bg-black rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 mb-8">
              <div className="space-y-1 mb-6">
                <h2 className="text-2xl text-gray-900 dark:text-gray-100">Grant Budget Structure & Milestones</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Each project must present a structured grant budget and define four (4) key milestones, each with 
                  clear deliverables, measurable success criteria, and an allocated budget. This ensures transparency, 
                  accountability, and effective resource allocation. A typical grant structure includes an upfront payment 
                  of up to 20%, provided at the start of the project to cover initial development costs, while the 
                  remaining grant amount is tied to the successful completion of quantifiable milestones with well-
                  defined KPIs and deliverables. Success metrics may include user adoption, performance 
                  improvements, developer engagement, or technical development milestones, depending on the 
                  project's stage. By aligning payments with measurable outcomes, this structure ensures efficient fund 
                  distribution, project accountability, and long-term success.
                </p>
                <div className="mt-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Milestone Format (Upto 4)</h3>
                  <ul className="list-disc pl-6 mt-2 space-y-2">
                    <li>
                      <span className="font-medium">Milestone Name:</span> A short, clear title describing the milestone's focus (e.g. Smart Contract Development & Initial Audit).
                    </li>
                    <li>
                      <span className="font-medium">Description:</span> A summary of the key activities and goals for the milestone (e.g. Develop, test, and audit).
                    </li>
                    <li>
                      <span className="font-medium">Deliverables & Success Metrics/KPIs:</span> Tangible outputs that demonstrate milestone completion and measurable indicators that define a successful milestone.
                    </li>
                    <li>
                      <span className="font-medium">Estimated Completion Date:</span> The expected completion date for the milestone.
                    </li>
                    <li>
                      <span className="font-medium">Amount Requested:</span> The grant amount that is needed to for this milestone.
                    </li>
                  </ul>
                </div>
              </div>
              
              <div className="space-y-6">
                {/* Upfront Payment */}
                <FormField
                  control={form.control}
                  name="upfront_payment_requested"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Upfront Payment <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormDescription>
                        How much of the total funding are you requesting to receive in advance, apart from the milestone allocations?
                      </FormDescription>
                      <FormControl>
                        <Input
                          type="number"
                          className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                          placeholder="Enter amount (e.g., 5000)"
                          {...field}
                          value={field.value === 0 ? "" : field.value}
                          onChange={(e) => {
                            const value = e.target.value === "" ? 0 : parseFloat(e.target.value);
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                {/* Milestone 1 */}
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">Milestone 1:</h3>
                  
                  <div className="space-y-6">
                    <FormField
                      control={form.control}
                      name="milestone_name_1"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-gray-200 text-md">
                            Milestone Name <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                              placeholder="Enter milestone name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="milestone_1_description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-gray-200 text-md">
                            Milestone Description <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              className="min-h-[100px] border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                              placeholder="Describe the milestone's key activities and goals"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="milestone_1_deliverables_kpi"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-gray-200 text-md">
                            Deliverables & Success Metrics/KPIs <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              className="min-h-[100px] border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                              placeholder="Describe tangible outputs and measurable success indicators"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="milestone_1_completion_date"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="dark:text-gray-200 text-md">
                            Estimated Completion Date <span className="text-red-500">*</span>
                          </FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={`w-full pl-3 text-left font-normal border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100 ${!field.value ? "text-muted-foreground" : ""}`}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 dark:bg-gray-800 dark:border-gray-700" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="milestone_1_amount_requested"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-gray-200 text-md">
                            Amount Requested <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                              placeholder="Enter amount (e.g., 10000)"
                              {...field}
                              value={field.value === 0 ? "" : field.value}
                              onChange={(e) => {
                                const value = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                field.onChange(value);
                              }}
                            />
                          </FormControl>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                {/* Milestone 2 */}
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">Milestone 2:</h3>
                  
                  <div className="space-y-6">
                    <FormField
                      control={form.control}
                      name="milestone_name_2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-gray-200 text-md">
                            Milestone Name <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                              placeholder="Enter milestone name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="milestone_2_description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-gray-200 text-md">
                            Milestone Description <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              className="min-h-[100px] border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                              placeholder="Describe the milestone's key activities and goals"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="milestone_2_deliverables_kpi"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-gray-200 text-md">
                            Deliverables & Success Metrics/KPIs <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              className="min-h-[100px] border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                              placeholder="Describe tangible outputs and measurable success indicators"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="milestone_2_completion_date"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="dark:text-gray-200 text-md">
                            Estimated Completion Date <span className="text-red-500">*</span>
                          </FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={`w-full pl-3 text-left font-normal border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100 ${!field.value ? "text-muted-foreground" : ""}`}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 dark:bg-gray-800 dark:border-gray-700" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="milestone_2_amount_requested"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-gray-200 text-md">
                            Amount Requested <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                              placeholder="Enter amount (e.g., 15000)"
                              {...field}
                              value={field.value === 0 ? "" : field.value}
                              onChange={(e) => {
                                const value = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                field.onChange(value);
                              }}
                            />
                          </FormControl>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                {/* Milestone 3 (Optional) */}
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">Milestone 3 (Optional):</h3>
                  
                  <div className="space-y-6">
                    <FormField
                      control={form.control}
                      name="milestone_name_3"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-gray-200 text-md">
                            Milestone Name
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                              placeholder="Enter milestone name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="milestone_3_description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-gray-200 text-md">
                            Milestone Description
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              className="min-h-[100px] border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                              placeholder="Describe the milestone's key activities and goals"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="milestone_3_deliverables_kpi"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-gray-200 text-md">
                            Deliverables & Success Metrics/KPIs
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              className="min-h-[100px] border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                              placeholder="Describe tangible outputs and measurable success indicators"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="milestone_3_completion_date"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="dark:text-gray-200 text-md">
                            Estimated Completion Date
                          </FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={`w-full pl-3 text-left font-normal border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100 ${!field.value ? "text-muted-foreground" : ""}`}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 dark:bg-gray-800 dark:border-gray-700" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="milestone_3_amount_requested"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-gray-200 text-md">
                            Amount Requested
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                              placeholder="Enter amount (e.g., 15000)"
                              {...field}
                              value={field.value === 0 ? "" : field.value}
                              onChange={(e) => {
                                const value = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                field.onChange(value);
                              }}
                            />
                          </FormControl>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                {/* Milestone 4 (Optional) */}
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-medium mb-4 text-gray-900 dark:text-gray-100">Milestone 4 (Optional):</h3>
                  
                  <div className="space-y-6">
                    <FormField
                      control={form.control}
                      name="milestone_name_4"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-gray-200 text-md">
                            Milestone Name
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                              placeholder="Enter milestone name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="milestone_4_description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-gray-200 text-md">
                            Milestone Description
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              className="min-h-[100px] border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                              placeholder="Describe the milestone's key activities and goals"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="milestone_4_deliverables_kpi"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-gray-200 text-md">
                            Deliverables & Success Metrics/KPIs
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              className="min-h-[100px] border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                              placeholder="Describe tangible outputs and measurable success indicators"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="milestone_4_completion_date"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel className="dark:text-gray-200 text-md">
                            Estimated Completion Date
                          </FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={`w-full pl-3 text-left font-normal border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100 ${!field.value ? "text-muted-foreground" : ""}`}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Pick a date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 dark:bg-gray-800 dark:border-gray-700" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="milestone_4_amount_requested"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-gray-200 text-md">
                            Amount Requested
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                              placeholder="Enter amount (e.g., 15000)"
                              {...field}
                              value={field.value === 0 ? "" : field.value}
                              onChange={(e) => {
                                const value = e.target.value === "" ? undefined : parseFloat(e.target.value);
                                field.onChange(value);
                              }}
                            />
                          </FormControl>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                {/* Additional Support Options */}
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700 space-y-6">
                  <FormField
                    control={form.control}
                    name="vc_fundraising_support_check"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="dark:text-gray-200 text-md">
                          Support with venture capital fundraising? <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormDescription>
                          Please indicate if you require assistance with venture capital fundraising
                        </FormDescription>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100">
                              <SelectValue placeholder="Select an option" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                            <SelectItem value="Yes" className="dark:text-gray-200">Yes</SelectItem>
                            <SelectItem value="No" className="dark:text-gray-200">No</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="dark:text-red-400" />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="aethir_ai_gaming_fund_check"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="dark:text-gray-200 text-md">
                          Support through Aethir's Ecosystem Fund for AI and gaming innovators? <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormDescription>
                          Would you like to be considered for computational resource support through Aethir's Ecosystem Fund for AI and gaming innovators? More information: <a href="https://www.avax.network/blog/avalanche-foundation-partners-with-aethir-to-fast-track-infrabuidl-ai-grantees-into-100m-ecosystem-fund" className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">https://www.avax.network/blog/avalanche-foundation-partners-with-aethir-to-fast-track-infrabuidl-ai-grantees-into-100m-ecosystem-fund</a>
                        </FormDescription>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100">
                              <SelectValue placeholder="Select an option" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                            <SelectItem value="Yes" className="dark:text-gray-200">Yes</SelectItem>
                            <SelectItem value="No" className="dark:text-gray-200">No</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="dark:text-red-400" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>
            
            {/* Contribution to the Avalanche Ecosystem */}
            <div className="bg-white dark:bg-black rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 mb-8">
              <div className="space-y-1 mb-6">
                <h2 className="text-2xl text-gray-900 dark:text-gray-100">Contribution to the Avalanche Ecosystem</h2>
              </div>
              
              <div className="space-y-6">
                {/* Current Development Stage */}
                <FormField
                  control={form.control}
                  name="current_development_stage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Current Development Stage <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormDescription>
                        Please share where you are in the development process.
                      </FormDescription>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Early-Stage (idea, Proof of Concept, prototype development)" id="early-stage" />
                            <label htmlFor="early-stage">Early-Stage (idea, Proof of Concept, prototype development)</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Mid-Stage (product on testnet, closed beta)" id="mid-stage" />
                            <label htmlFor="mid-stage">Mid-Stage (product on testnet, closed beta)</label>
                          </div>
                          <div className="flex items-center space-x-2">
<RadioGroupItem value="Late-Stage (product live with onchain metrics)" id="late-stage" />
                            <label htmlFor="late-stage">Late-Stage (product live with onchain metrics)</label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                {/* Duration working on the project */}
                <FormField
                  control={form.control}
                  name="project_work_duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Duration working on the project <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="0-3 months" id="0-3-months" />
                            <label htmlFor="0-3-months">0-3 months</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="4-6 months" id="4-6-months" />
                            <label htmlFor="4-6-months">4-6 months</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="7-12 months" id="7-12-months" />
                            <label htmlFor="7-12-months">7-12 months</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="1-2 years" id="1-2-years" />
                            <label htmlFor="1-2-years">1-2 years</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="2+ years" id="2-plus-years" />
                            <label htmlFor="2-plus-years">2+ years</label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                {/* Project live status */}
                <FormField
                  control={form.control}
                  name="project_live_status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Project live status <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Not Live" id="not-live" />
                            <label htmlFor="not-live">Not Live</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Live on Testnet" id="live-testnet" />
                            <label htmlFor="live-testnet">Live on Testnet</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Live on Mainnet" id="live-mainnet" />
                            <label htmlFor="live-mainnet">Live on Mainnet</label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                {/* Is your project multichain? */}
                <FormField
                  control={form.control}
                  name="multichain_check"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Is your project multichain? <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(value) => {
                            field.onChange(value);
                            setShowMultichainDetails(value === "Yes");
                          }}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Yes" id="multichain-yes" />
                            <label htmlFor="multichain-yes">Yes</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="No" id="multichain-no" />
                            <label htmlFor="multichain-no">No</label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                {/* Share which chain(s) */}
                {showMultichainDetails && (
                  <FormField
                    control={form.control}
                    name="multichain_chains"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="dark:text-gray-200 text-md">
                          Share which chain(s): <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            className="min-h-[100px] border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                            placeholder="List the chains your project supports or plans to support"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="dark:text-red-400" />
                      </FormItem>
                    )}
                  />
                )}
                
                {/* Will this be your first time building in the Avalanche Ecosystem? */}
                <FormField
                  control={form.control}
                  name="first_build_avalanche"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Will this be your first time building in the Avalanche Ecosystem? <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(value) => {
                            field.onChange(value);
                            setShowPreviousProjectDetails(value === "No");
                          }}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Yes" id="first-build-yes" />
                            <label htmlFor="first-build-yes">Yes</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="No" id="first-build-no" />
                            <label htmlFor="first-build-no">No</label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                {/* Share your previous project name(s) and details */}
                {showPreviousProjectDetails && (
                  <FormField
                    control={form.control}
                    name="previous_avalanche_project_info"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="dark:text-gray-200 text-md">
                          Share your previous project name(s) and details: <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            className="min-h-[100px] border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                            placeholder="Describe your previous Avalanche projects and experience"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="dark:text-red-400" />
                      </FormItem>
                    )}
                  />
                )}
                
                {/* Contribution to the Avalanche Ecosystem */}
                <FormField
                  control={form.control}
                  name="avalanche_contribution"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Contribution to the Avalanche Ecosystem <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormDescription>
                        Please explain how your project contributes to Avalanche and your expected outcomes. Be specific about the outcomes you expect to see on the Avalanche Network as a result of you potentially receiving this grant.
                      </FormDescription>
                      <FormControl>
                        <Textarea
                          className="min-h-[150px] border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                          placeholder="E.g., 10,000 new unique wallets on Avalanche in the first 6 months of launch."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                {/* Would any existing Avalanche projects/L1s benefit from your proposal being implemented? */}
                <FormField
                  control={form.control}
                  name="avalanche_benefit_check"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Would any existing Avalanche projects/L1s benefit from your proposal being implemented? <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(value) => {
                            field.onChange(value);
                            setShowBenefitDetails(value === "Yes");
                          }}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Yes" id="avalanche-benefit-yes" />
                            <label htmlFor="avalanche-benefit-yes">Yes</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="No" id="avalanche-benefit-no" />
                            <label htmlFor="avalanche-benefit-no">No</label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                {/* Benefiting projects */}
                {showBenefitDetails && (
                  <>
                    <div className="space-y-6 border-l-2 border-gray-200 pl-4 dark:border-gray-700">
                      <FormField
                        control={form.control}
                        name="avalanche_l1_project_benefited_1"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="dark:text-gray-200 text-md">
                              First Project/L1: Name and how they would benefit <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                                placeholder="Project name and benefit"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="dark:text-red-400" />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="avalanche_l1_project_benefited_1_website"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="dark:text-gray-200 text-md">
                              First Project/L1: Website <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                                placeholder="https://project-website.com"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="dark:text-red-400" />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="avalanche_l1_project_benefited_2"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="dark:text-gray-200 text-md">
                              Second Project/L1: Name and how they would benefit
                            </FormLabel>
                            <FormControl>
                              <Input
                                className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                                placeholder="Project name and benefit"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="dark:text-red-400" />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="avalanche_l1_project_benefited_2_website"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="dark:text-gray-200 text-md">
                              Second Project/L1: Website
                            </FormLabel>
                            <FormControl>
                              <Input
                                className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                                placeholder="https://project-website.com"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="dark:text-red-400" />
                          </FormItem>
                        )}
                      />
                    </div>
                  </>
                )}
                
                {/* Are there any Web2 or Web3 projects that are similar to yours? */}
                <FormField
                  control={form.control}
                  name="similar_project_check"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Are there any Web2 or Web3 projects that are similar to yours? <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(value) => {
                            field.onChange(value);
                            setShowSimilarProjects(value === "Yes");
                          }}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Yes" id="similar-project-yes" />
                            <label htmlFor="similar-project-yes">Yes</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="No" id="similar-project-no" />
                            <label htmlFor="similar-project-no">No</label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                {/* Similar projects */}
                {showSimilarProjects && (
                  <div className="space-y-6 border-l-2 border-gray-200 pl-4 dark:border-gray-700">
                    <FormField
                      control={form.control}
                      name="similar_project_name_1"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-gray-200 text-md">
                            Project 1: Name
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                              placeholder="Project name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="similar_project_website_1"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-gray-200 text-md">
                            Project 1: Website
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                              placeholder="https://project-website.com"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="similar_project_name_2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-gray-200 text-md">
                            Project 2: Name
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                              placeholder="Project name"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="similar_project_website_2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-gray-200 text-md">
                            Project 2: Website
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                              placeholder="https://project-website.com"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
                
                {/* Does your project have any direct competitors? */}
                <FormField
                  control={form.control}
                  name="direct_competitor_check"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Does your project have any direct competitors? <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(value) => {
                            field.onChange(value);
                            setShowCompetitors(value === "Yes");
                          }}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Yes" id="direct-competitor-yes" />
                            <label htmlFor="direct-competitor-yes">Yes</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="No" id="direct-competitor-no" />
                            <label htmlFor="direct-competitor-no">No</label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                {/* Competitors */}
                {showCompetitors && (
                  <div className="space-y-6 border-l-2 border-gray-200 pl-4 dark:border-gray-700">
                    <FormField
                      control={form.control}
                      name="direct_competitor_1"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-gray-200 text-md">
                            Direct Competitor 1 <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              className="min-h-[100px] border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                              placeholder="Describe your competitor and how your project differs"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="direct_competitor_1_website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-gray-200 text-md">
                            Direct Competitor 1 Website <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                              placeholder="https://competitor-website.com"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="direct_competitor_2"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-gray-200 text-md">
                            Direct Competitor 2
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              className="min-h-[100px] border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                              placeholder="Describe your competitor and how your project differs"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="direct_competitor_2_website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="dark:text-gray-200 text-md">
                            Direct Competitor 2 Website
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                              placeholder="https://competitor-website.com"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                  </div>
                )}
                
                {/* Do you plan on launching your project's token on Avalanche? */}
                <FormField
                  control={form.control}
                  name="token_launch_avalanche_check"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Do you plan on launching your project's token on Avalanche? <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(value) => {
                            field.onChange(value);
                            setShowTokenLaunchDetails(value === "No");
                          }}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Yes" id="token-launch-yes" />
                            <label htmlFor="token-launch-yes">Yes</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="No" id="token-launch-no" />
                            <label htmlFor="token-launch-no">No</label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                {/* Token launch details */}
                {showTokenLaunchDetails && (
                  <FormField
                    control={form.control}
                    name="token_launch_other"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="dark:text-gray-200 text-md">
                          What chain(s) will you launch your token on and why?
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            className="min-h-[100px] border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                            placeholder="Explain which chains you plan to launch your token on and your reasoning"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="dark:text-red-400" />
                      </FormItem>
                    )}
                  />
                )}
                
                {/* Is your project open source? */}
                <FormField
                  control={form.control}
                  name="open_source_check"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Is your project open source? <span className="text-red-500">*</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100">
                            <SelectValue placeholder="Select an option" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                          <SelectItem value="Yes" className="dark:text-gray-200">Yes</SelectItem>
                          <SelectItem value="No" className="dark:text-gray-200">No</SelectItem>
                          <SelectItem value="Partially" className="dark:text-gray-200">Partially</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            {/* Applicant Information */}
            <div className="bg-white dark:bg-black rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 mb-8">
              <div className="space-y-1 mb-6">
                <h2 className="text-2xl text-gray-900 dark:text-gray-100">Applicant Information</h2>
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="firstname"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="dark:text-gray-200 text-md">
                          Applicant First Name <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                            placeholder="Enter your first name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="dark:text-red-400" />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="lastname"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="dark:text-gray-200 text-md">
                          Applicant Last Name <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                            placeholder="Enter your last name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="dark:text-red-400" />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Applicant Email <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                          placeholder="Enter your email address"
                          type="email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="applicant_job_role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Applicant Job Title <span className="text-red-500">*</span>
                      </FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          setShowJobRoleOther(value === "Other");
                        }} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100">
                            <SelectValue placeholder="Select your job role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                          {jobRoles.map((role) => (
<SelectItem key={role} value={role} className="dark:text-gray-200">
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                {/* Job Role Other */}
                {showJobRoleOther && (
                  <FormField
                    control={form.control}
                    name="applicant_job_role_other"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="dark:text-gray-200 text-md">
                          Please specify your job title <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                            placeholder="Specify your job title"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="dark:text-red-400" />
                      </FormItem>
                    )}
                  />
                )}
                
                <FormField
                  control={form.control}
                  name="applicant_bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Applicant Bio <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          className="min-h-[150px] border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                          placeholder="Provide a brief bio, including your background and experience"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="applicant_country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Country of Residence
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100">
                            <SelectValue placeholder="Select your country" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                          {countries.map((country) => (
                            <SelectItem key={country} value={country} className="dark:text-gray-200">
                              {country}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="x_account"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        X Account <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormDescription>
                        Share the link to your X account.
                      </FormDescription>
                      <FormControl>
                        <Input
                          className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                          placeholder="https://twitter.com/yourusername"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="telegram"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Telegram <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormDescription>
                        Share the link to your Telegram account.
                      </FormDescription>
                      <FormControl>
                        <Input
                          className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                          placeholder="https://t.me/yourusername"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="linkedin"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        LinkedIn
                      </FormLabel>
                      <FormDescription>
                        Share the link to your LinkedIn account.
                      </FormDescription>
                      <FormControl>
                        <Input
                          className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                          placeholder="https://linkedin.com/in/yourusername"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="github"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        GitHub
                      </FormLabel>
                      <FormDescription>
                        Share the link to your GitHub account.
                      </FormDescription>
                      <FormControl>
                        <Input
                          className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                          placeholder="https://github.com/yourusername"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="other_resources"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Other Resource(s)
                      </FormLabel>
                      <FormDescription>
                        Share any additional links that support your application. This could include portfolios, websites, media coverage, case studies, or anything else that helps illustrate your work or impact.
                      </FormDescription>
                      <FormControl>
                        <Textarea
                          className="min-h-[100px] border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                          placeholder="Additional resources or links"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            {/* Team Details */}
            <div className="bg-white dark:bg-black rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 mb-8">
              <div className="space-y-1 mb-6">
                <h2 className="text-2xl text-gray-900 dark:text-gray-100">Team Details</h2>
              </div>
              
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="team_size"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Team size <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(value) => {
                            field.onChange(value);
                            setShowTeamMembers(value !== "1" && value !== "");
                          }}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="1" id="team-size-1" />
                            <label htmlFor="team-size-1">1</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="2-5" id="team-size-2-5" />
                            <label htmlFor="team-size-2-5">2-5</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="6-10" id="team-size-6-10" />
                            <label htmlFor="team-size-6-10">6-10</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="10+" id="team-size-10-plus" />
                            <label htmlFor="team-size-10-plus">10+</label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                {/* Team Members (conditionally shown) */}
                {showTeamMembers && (
                  <div className="mt-8 space-y-8">
                    <div>
                      <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-gray-100">Team Members</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                        If applicable, you will be prompted to add two more team members other than the main applicant.
                        Demonstrate the team's technical prowess and track record, ensuring they can deliver on their vision.
                      </p>
                    </div>
                    
                    {/* Team Member 1 */}
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <h3 className="text-md font-medium mb-4 text-gray-900 dark:text-gray-100">Team Member 1:</h3>
                      
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <FormField
                            control={form.control}
                            name="team_member_1_first_name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="dark:text-gray-200 text-md">
                                  First Name
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                                    placeholder="First name"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage className="dark:text-red-400" />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="team_member_1_last_name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="dark:text-gray-200 text-md">
                                  Last Name
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                                    placeholder="Last name"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage className="dark:text-red-400" />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <FormField
                          control={form.control}
                          name="team_member_1_email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="dark:text-gray-200 text-md">
                                Email
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                                  placeholder="email@example.com"
                                  type="email"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage className="dark:text-red-400" />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="job_role_team_member_1"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="dark:text-gray-200 text-md">
                                Job Role
                              </FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100">
                                    <SelectValue placeholder="Select job role" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                                  {jobRoles.map((role) => (
                                    <SelectItem key={role} value={role} className="dark:text-gray-200">
                                      {role}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage className="dark:text-red-400" />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="team_member_1_bio"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="dark:text-gray-200 text-md">
                                Bio
                              </FormLabel>
                              <FormControl>
                                <Textarea
                                  className="min-h-[100px] border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                                  placeholder="Brief bio and experience"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage className="dark:text-red-400" />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="team_member_1_x_account"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="dark:text-gray-200 text-md">
                                X Account
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                                  placeholder="https://twitter.com/username"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage className="dark:text-red-400" />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="team_member_1_telegram"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="dark:text-gray-200 text-md">
                                Telegram
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                                  placeholder="https://t.me/username"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage className="dark:text-red-400" />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="team_member_1_linkedin"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="dark:text-gray-200 text-md">
                                LinkedIn
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                                  placeholder="https://linkedin.com/in/username"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage className="dark:text-red-400" />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="team_member_1_github"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="dark:text-gray-200 text-md">
                                GitHub
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                                  placeholder="https://github.com/username"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage className="dark:text-red-400" />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="team_member_1_country"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="dark:text-gray-200 text-md">
                                Country
                              </FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100">
                                    <SelectValue placeholder="Select country" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                                  {countries.map((country) => (
                                    <SelectItem key={country} value={country} className="dark:text-gray-200">
                                      {country}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage className="dark:text-red-400" />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="other_resource_s__team_member_1"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="dark:text-gray-200 text-md">
                                Other Resource(s)
                              </FormLabel>
                              <FormDescription>
                                Share any additional links that support your application. This could include portfolios, websites, media coverage, case studies, or anything else that helps illustrate your work or impact.
                              </FormDescription>
                              <FormControl>
                                <Textarea
                                  className="min-h-[100px] border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                                  placeholder="Additional resources or links"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage className="dark:text-red-400" />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                    
                    {/* Team Member 2 */}
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <h3 className="text-md font-medium mb-4 text-gray-900 dark:text-gray-100">Team Member 2:</h3>
                      
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <FormField
                            control={form.control}
                            name="team_member_2_first_name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="dark:text-gray-200 text-md">
                                  First Name
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                                    placeholder="First name"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage className="dark:text-red-400" />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="team_member_2_last_name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="dark:text-gray-200 text-md">
                                  Last Name
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                                    placeholder="Last name"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage className="dark:text-red-400" />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <FormField
                          control={form.control}
                          name="team_member_2_email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="dark:text-gray-200 text-md">
                                Email
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                                  placeholder="email@example.com"
                                  type="email"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage className="dark:text-red-400" />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="job_role_team_member_2"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="dark:text-gray-200 text-md">
                                Job Role
                              </FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100">
                                    <SelectValue placeholder="Select job role" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                                  {jobRoles.map((role) => (
                                    <SelectItem key={role} value={role} className="dark:text-gray-200">
                                      {role}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage className="dark:text-red-400" />
                            </FormItem>
                          )}
                        />
                        
                        {/* Rest of team member 2 fields (similar to team member 1) */}
                        {/* ... (similar fields as team member 1) */}
                        <FormField
                          control={form.control}
                          name="team_member_2_bio"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="dark:text-gray-200 text-md">
                                Bio
                              </FormLabel>
                              <FormControl>
                                <Textarea
                                  className="min-h-[100px] border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                                  placeholder="Brief bio and experience"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage className="dark:text-red-400" />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="team_member_2_x_account"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="dark:text-gray-200 text-md">
                                X Account
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                                  placeholder="https://twitter.com/username"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage className="dark:text-red-400" />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="team_member_2_telegram"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="dark:text-gray-200 text-md">
                                Telegram
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                                  placeholder="https://t.me/username"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage className="dark:text-red-400" />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="team_member_2_linkedin"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="dark:text-gray-200 text-md">
                                LinkedIn
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                                  placeholder="https://linkedin.com/in/username"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage className="dark:text-red-400" />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="team_member_2_github"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="dark:text-gray-200 text-md">
                                GitHub
                              </FormLabel>
                              <FormControl>
                                <Input
                                  className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                                  placeholder="https://github.com/username"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage className="dark:text-red-400" />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="team_member_2_country"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="dark:text-gray-200 text-md">
                                Country
                              </FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100">
                                    <SelectValue placeholder="Select country" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                                  {countries.map((country) => (
                                    <SelectItem key={country} value={country} className="dark:text-gray-200">
                                      {country}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage className="dark:text-red-400" />
                            </FormItem>
                          )}
                        />
                        
                        <FormField
                          control={form.control}
                          name="other_resource_s__team_member_2"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="dark:text-gray-200 text-md">
                                Other Resource(s)
                              </FormLabel>
                              <FormDescription>
                                Share any additional links that support your application. This could include portfolios, websites, media coverage, case studies, or anything else that helps illustrate your work or impact.
                              </FormDescription>
                              <FormControl>
                                <Textarea
                                  className="min-h-[100px] border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                                  placeholder="Additional resources or links"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage className="dark:text-red-400" />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Other */}
            <div className="bg-white dark:bg-black rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 mb-8">
              <div className="space-y-1 mb-6">
                <h2 className="text-2xl text-gray-900 dark:text-gray-100">Other</h2>
              </div>
              
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="avalanche_grant_source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        How did you hear about the Grant Program? <span className="text-red-500">*</span>
                      </FormLabel>
                      <Select 
                        onValueChange={(value) => {
                          field.onChange(value);
                          setShowGrantSource(value === "Other");
                        }} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100">
                            <SelectValue placeholder="Select an option" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                          <SelectItem value="Avalanche Website" className="dark:text-gray-200">Avalanche Website</SelectItem>
                          <SelectItem value="Avalanche Forum" className="dark:text-gray-200">Avalanche Forum</SelectItem>
                          <SelectItem value="Twitter/X" className="dark:text-gray-200">Twitter/X</SelectItem>
                          <SelectItem value="Telegram" className="dark:text-gray-200">Telegram</SelectItem>
                          <SelectItem value="LinkedIn" className="dark:text-gray-200">LinkedIn</SelectItem>
                          <SelectItem value="Livestream" className="dark:text-gray-200">Livestream</SelectItem>
                          <SelectItem value="The Arena" className="dark:text-gray-200">The Arena</SelectItem>
                          <SelectItem value="Email" className="dark:text-gray-200">Email</SelectItem>
                          <SelectItem value="Word of Mouth" className="dark:text-gray-200">Word of Mouth</SelectItem>
                          <SelectItem value="Event" className="dark:text-gray-200">Event</SelectItem>
                          <SelectItem value="Other" className="dark:text-gray-200">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                {/* Source Other */}
                {watchGrantSource === "Other" && (
                  <FormField
                    control={form.control}
                    name="avalanche_grant_source_other"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="dark:text-gray-200 text-md">
                          Let us know how you heard about the program
                        </FormLabel>
                        <FormControl>
                          <Input
                            className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                            placeholder="Please specify"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="dark:text-red-400" />
                      </FormItem>
                    )}
                  />
                )}
                
                {/* Did someone specific refer you to the program? */}
                <FormField
                  control={form.control}
                  name="program_referral_check"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="dark:text-gray-200 text-md">
                        Did someone specific refer you to the program? <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(value) => {
                            field.onChange(value);
                            setShowReferrer(value === "Yes");
                          }}
                          defaultValue={field.value}
                          className="flex flex-col space-y-1"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Yes" id="referral-yes" />
                            <label htmlFor="referral-yes">Yes</label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="No" id="referral-no" />
                            <label htmlFor="referral-no">No</label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage className="dark:text-red-400" />
                    </FormItem>
                  )}
                />
                
                {/* Referrer */}
                {showReferrer && (
                  <FormField
                    control={form.control}
                    name="program_referrer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="dark:text-gray-200 text-md">
                          Share the name of the person who referred you <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800 dark:text-gray-100"
                            placeholder="Referrer's name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="dark:text-red-400" />
                      </FormItem>
                    )}
                  />
                )}
                
                {/* Legal Compliance */}
                <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    The Avalanche Foundation needs the contact information you provide to us to contact you about our products and services. You may unsubscribe from these communications at any time. For information on how to unsubscribe, as well as our privacy practices and commitment to protecting your privacy, please review our <a href="#" className="text-blue-500 hover:underline">Privacy Policy</a>.
                  </p>
                  
                  <FormField
                    control={form.control}
                    name="gdpr"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-gray-200 dark:border-gray-700 p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="font-normal dark:text-gray-200">
                            By checking this box, you agree and authorize the Avalanche Foundation to utilize artificial intelligence systems to process the information in your application, any related material you provide to us and any related communications between you and the Avalanche Foundation, in order to assess the eligibility and suitability of your application and proposal. You can withdraw your consent at any time. For more details on data processing and your rights, please refer to our Privacy Policy, linked above. <span className="text-red-500">*</span>
                          </FormLabel>
                        </div>
                        <FormMessage className="dark:text-red-400" />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="marketing_consent"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-gray-200 dark:border-gray-700 p-4 mt-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="border-gray-300 dark:border-zinc-800 dark:bg-zinc-800"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="font-normal dark:text-gray-200">
                            Check this box to stay up to date with all things Avalanche, including promotional emails about events, initiatives and programs. You can unsubscribe anytime.
                          </FormLabel>
                        </div>
                        <FormMessage className="dark:text-red-400" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>
            <div className="pt-4 flex justify-end">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-2 bg-[#EB4C50] hover:bg-[#EB4C50]/90 dark:bg-[#EB4C50] dark:hover:bg-[#EB4C50]/90"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  "Submit"
                )}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}