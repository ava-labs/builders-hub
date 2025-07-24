"use client";

import { type ReactNode, useState, useEffect } from "react";
import Image from "next/image";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import {
  User,
  Building2,
  FileText,
  Globe,
  MessageSquare,
  Github,
  DollarSign,
  Users,
  Shield,
  Check,
  ArrowRight,
  Rocket,
  Loader2,
  Mail,
  Briefcase,
  BookUser,
  Info,
  Link,
  Linkedin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  formSchema,
  jobRoles,
  continents,
  countries,
  projectVerticals,
  avalancheFundingTypes,
  nonAvalancheFundingTypes,
} from "@/types/retro9000Form";

type FormValues = z.infer<typeof formSchema>;

const SectionHeader = ({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
}) => (
  <div className="space-y-2 mb-8">
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-900/50 rounded-lg flex items-center justify-center">
        {icon}
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">{subtitle}</p>
      </div>
    </div>
  </div>
);

export default function Retro9000ApplicationForm() {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionStatus, setSubmissionStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [showTeamMembers, setShowTeamMembers] = useState<boolean>(false);
  const [showProjectVerticalOther, setShowProjectVerticalOther] =
    useState<boolean>(false);
  const [showJobRoleOther, setShowJobRoleOther] = useState<boolean>(false);
  const [showFundingDetails, setShowFundingDetails] = useState<boolean>(false);
  const [showMultichainDetails, setShowMultichainDetails] =
    useState<boolean>(false);
  const [showPreviousProjectDetails, setShowPreviousProjectDetails] =
    useState<boolean>(false);
  const [showBenefitDetails, setShowBenefitDetails] = useState<boolean>(false);
  const [showSimilarProjects, setShowSimilarProjects] =
    useState<boolean>(false);
  const [showCompetitors, setShowCompetitors] = useState<boolean>(false);
  const [showTokenLaunchDetails, setShowTokenLaunchDetails] =
    useState<boolean>(false);
  const [showReferrer, setShowReferrer] = useState<boolean>(false);
  const [showGrantSource, setShowGrantSource] = useState<boolean>(false);
  const [showRetro9000Changes, setShowRetro9000Changes] =
    useState<boolean>(false);
  const [showCompanyTypeOther, setShowCompanyTypeOther] =
    useState<boolean>(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      project_name: "Temporary",
      project: "",
      project_type: "",
      project_vertical: "",
      project_vertical_other: "",
      project_abstract_objective: "",
      technical_roadmap: "",
      repositories_achievements: "",
      risks_challenges: "",
      project_company_github: "",
      company_type: "",
      company_type_other: "",
      project_company_hq: "",
      project_company_continent: "",
      media_kit: "",
      previous_funding: [],
      previous_avalanche_funding_grants: [],
      requested_funding_range: "",
      eligibility_and_metrics: "",
      requested_grant_size_budget: "",
      previous_retro9000_funding: "",
      retro9000_previous_funding_amount: "",
      vc_fundraising_support_check: "",
      current_development_stage: "",
      project_work_duration: "",
      project_live_status: "",
      multichain_check: "",
      first_build_avalanche: "",
      avalanche_contribution: "",
      avalanche_benefit_check: "",
      similar_project_check: "",
      direct_competitor_check: "",
      token_launch_avalanche_check: "",
      token_launch_other_explanation: "",
      previous_avalanche_project_info: "",
      avalanche_l1_project_benefited_1_name: "",
      avalanche_l1_project_benefited_1_website: "",
      avalanche_l1_project_benefited_2_name: "",
      avalanche_l1_project_benefited_2_website: "",
      similar_project_name_1: "",
      similar_project_website_1: "",
      similar_project_name_2: "",
      similar_project_website_2: "",
      direct_competitor_1_name: "",
      direct_competitor_1_website: "",
      direct_competitor_2_name: "",
      direct_competitor_2_website: "",
      open_source_check: "",
      firstname: "",
      lastname: "",
      applicant_job_role: "",
      email: "",
      x_account: "",
      telegram: "",
      linkedin: "",
      other_resources: "",
      applicant_bio: "",
      university_affiliation: "",
      team_size: "",
      team_member_1_first_name: "",
      team_member_1_last_name: "",
      team_member_1_email: "",
      job_role_team_member_1: "",
      team_member_1_x_account: "",
      team_member_1_telegram: "",
      team_member_1_linkedin: "",
      team_member_1_github: "",
      team_member_1_other: "",
      team_member_1_bio: "",
      team_member_2_first_name: "",
      team_member_2_last_name: "",
      team_member_2_email: "",
      job_role_team_member_2: "",
      team_member_2_x_account: "",
      team_member_2_telegram: "",
      team_member_2_linkedin: "",
      team_member_2_github: "",
      team_member_2_other: "",
      team_member_2_bio: "",
      avalanche_grant_source: "",
      program_referral_check: "",
      kyb_willing: "",
      gdpr: false,
      marketing_consent: false,
    },
  });

  const watchTeamSize = form.watch("team_size");
  const watchProjectVertical = form.watch("project_vertical");
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
  const watchPreviousRetro9000 = form.watch("previous_retro9000_funding");
  const watchCompanyType = form.watch("company_type");

  useEffect(() => {
    setShowTeamMembers(watchTeamSize !== "1" && watchTeamSize !== "");
    setShowProjectVerticalOther(watchProjectVertical === "Other");
    setShowJobRoleOther(watchApplicantJobRole === "Other");
    setShowFundingDetails(
      watchPreviousFunding &&
        watchPreviousFunding.length > 0 &&
        !watchPreviousFunding.every((item) => item === "No Funding")
    );
    setShowGrantSource(watchGrantSource === "Other");
    setShowRetro9000Changes(watchPreviousRetro9000 === "Yes");
    setShowMultichainDetails(watchMultichainCheck === "Yes");
    setShowPreviousProjectDetails(watchFirstBuildAvalanche === "No");
    setShowBenefitDetails(watchAvalancheBenefitCheck === "Yes");
    setShowSimilarProjects(watchSimilarProjectCheck === "Yes");
    setShowCompetitors(watchDirectCompetitorCheck === "Yes");
    setShowTokenLaunchDetails(watchTokenLaunchCheck === "No");
    setShowReferrer(watchReferralCheck === "Yes");
    setShowCompanyTypeOther(watchCompanyType === "Other");
  }, [
    watchTeamSize,
    watchProjectVertical,
    watchApplicantJobRole,
    watchPreviousFunding,
    watchMultichainCheck,
    watchFirstBuildAvalanche,
    watchAvalancheBenefitCheck,
    watchSimilarProjectCheck,
    watchDirectCompetitorCheck,
    watchTokenLaunchCheck,
    watchGrantSource,
    watchReferralCheck,
    watchPreviousRetro9000,
    watchCompanyType,
  ]);

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/retro9000", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to submit application");
      }

      if (result.success) {
        setSubmissionStatus("success");
        window.scrollTo(0, 0);
      } else {
        throw new Error(result.message || "Submission failed");
      }
    } catch (error) {
      setSubmissionStatus("error");
      console.error("Form submission error:", error);
      alert(
        `Error submitting application: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const onSubmitError = (errors: any) => {
    const firstError = Object.keys(errors)[0];
    if (firstError) {
      const firstErrorElement = document.querySelector(
        `[name="${firstError}"]`
      );
      if (firstErrorElement) {
        firstErrorElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
    alert(
      `Please fix the following errors:\n${Object.keys(errors)
        .map((key) => `- ${errors[key]?.message || key}`)
        .join("\n")}`
    );
  };

  const avalancheFundingAmountFields: Record<string, keyof FormValues> = {
    Codebase: "funding_amount_codebase",
    "infraBUIDL()": "funding_amount_infrabuidl",
    "infraBUIDL(AI)": "funding_amount_infrabuidl_ai",
    Retro9000: "funding_amount_retro9000",
    Blizzard: "funding_amount_blizzard",
    "Ava Labs Investment": "funding_amount_avalabs",
    Other: "funding_amount_other_avalanche",
  };

  const nonAvalancheFundingAmountFields: Record<string, keyof FormValues> = {
    "Self-Funding": "funding_amount_self_funding",
    "Family & Friends": "funding_amount_family_friends",
    Grant: "funding_amount_grant",
    "Angel Investment": "funding_amount_angel",
    "Pre-Seed": "funding_amount_pre_seed",
    Seed: "funding_amount_seed",
    "Series A": "funding_amount_series_a",
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <section className="text-center space-y-8 pt-8 pb-12">
        <div className="flex justify-center mb-8">
          <div className="relative">
            <Image
              src="/logo-black.png"
              alt="Avalanche Logo"
              width={240}
              height={60}
              className="dark:hidden"
            />
            <Image
              src="/logo-white.png"
              alt="Avalanche Logo"
              width={240}
              height={60}
              className="hidden dark:block"
            />
          </div>
        </div>
        <div className="space-y-6">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 dark:from-white dark:via-slate-200 dark:to-white bg-clip-text text-transparent">
            Retro9000
            <span className="block text-[#EB4C50] bg-gradient-to-r from-[#EB4C50] to-[#d63384] bg-clip-text flex items-center justify-center gap-4">
              Grants Program
              <Rocket className="w-10 h-10 md:w-14 md:h-14 text-[#EB4C50] animate-pulse stroke-3" />
            </span>
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Apply for funding to build innovative projects on Avalanche. Join
            our ecosystem and help shape the future of decentralized
            applications.
          </p>
        </div>
      </section>

      {submissionStatus === "success" ? (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-12 text-center shadow-lg">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-3xl font-bold text-emerald-800 dark:text-emerald-200 mb-4">
            Application Submitted Successfully!
          </h2>
          <p className="text-emerald-700 dark:text-emerald-300 mb-8 text-lg">
            Thank you for applying to the Retro9000 grant program. We will
            review your application and get back to you soon.
          </p>
          <Button
            onClick={() => {
              setSubmissionStatus("idle");
              form.reset();
            }}
            className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white px-8 py-3 text-lg font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
          >
            Submit Another Application
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      ) : (
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit, onSubmitError)}
              className="space-y-0"
            >
              <div className="p-8 md:p-12 border-b border-slate-100 dark:border-slate-700">
                <SectionHeader
                  icon={
                    <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  }
                  title="Applicant Information"
                  subtitle="Tell us about yourself"
                />
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="firstname"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            First Name <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                              <Input
                                className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                placeholder="First name"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-500 dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastname"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            Last Name <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                              <Input
                                className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                placeholder="Last name"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-500 dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Email Address <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                            <Input
                              className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              placeholder="email@example.com"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="telegram"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            Telegram Handle{" "}
                            <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <MessageSquare className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                              <Input
                                className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                placeholder="t.me/username"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-500 dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="x_account"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            X Profile <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <MessageSquare className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                              <Input
                                className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                placeholder="https://x.com/username"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-500 dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="linkedin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          LinkedIn
                        </FormLabel>
                        <FormDescription className="text-sm text-slate-500 dark:text-slate-400">
                          Share the link to your LinkedIn account.
                        </FormDescription>
                        <FormControl>
                          <div className="relative">
                            <Linkedin className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                            <Input
                              className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              placeholder="https://linkedin.com/in/username"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="applicant_bio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Bio <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormDescription className="text-sm text-slate-500 dark:text-slate-400">
                          100 words limit
                        </FormDescription>
                        <FormControl>
                          <div className="relative">
                            <BookUser className="absolute left-4 top-4 w-5 h-5 text-slate-400 dark:text-slate-500" />
                            <Textarea
                              placeholder="Provide a brief bio, including your background and experience"
                              className="pl-12 pt-4 min-h-[120px] text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="applicant_job_role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Role <span className="text-red-500">*</span>
                        </FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            setShowJobRoleOther(value === "Other");
                          }}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200">
                              <SelectValue placeholder="Select your job role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl shadow-xl">
                            {jobRoles.map((role) => (
                              <SelectItem
                                key={role}
                                value={role}
                                className="text-slate-700 dark:text-slate-300 py-3"
                              >
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />
                  {showJobRoleOther && (
                    <FormField
                      control={form.control}
                      name="applicant_job_role_other"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            Please specify your job title{" "}
                            <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Briefcase className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                              <Input
                                className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                placeholder="Specify your job title"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-500 dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                  )}
                  <FormField
                    control={form.control}
                    name="university_affiliation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Are you affiliated with a university?{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-3"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="Yes"
                                id="uni-yes"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="uni-yes"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                Yes
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="No"
                                id="uni-no"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="uni-no"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                No
                              </label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="other_resources"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Other Resource(s)
                        </FormLabel>
                        <FormDescription className="text-sm text-slate-500 dark:text-slate-400">
                          Share any additional links that support your
                          application. This could include portfolios, websites,
                          media coverage, case studies, or anything else that
                          helps illustrate your work or impact.
                        </FormDescription>
                        <FormControl>
                          <div className="relative">
                            <Link className="absolute left-4 top-4 w-5 h-5 text-slate-400 dark:text-slate-500" />
                            <Textarea
                              placeholder="Add any relevant links such as portfolios, websites, media coverage, case studies, etc."
                              className="pl-12 pt-4 min-h-[120px] text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="p-8 md:p-12 border-b border-slate-100 dark:border-slate-700">
                <SectionHeader
                  icon={
                    <Building2 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  }
                  title="Project Information"
                  subtitle="Tell us about your project"
                />
                <div className="space-y-8">
                  {/* Hidden field for project name */}
                  <FormField
                    control={form.control}
                    name="project_name"
                    render={({ field }) => (
                      <FormItem style={{ display: "none" }}>
                        <FormControl>
                          <Input type="hidden" {...field} value="Temporary" />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="project"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Project/Company Name{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Building2 className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                            <Input
                              className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              placeholder="Enter your project or company name"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="project_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Project/Company Type{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-3"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="L1"
                                id="l1"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="l1"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                L1
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="L1 Tooling"
                                id="l1-tooling"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="l1-tooling"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                L1 Tooling
                              </label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="project_vertical"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Project/Company Vertical
                        </FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            setShowProjectVerticalOther(value === "Other");
                          }}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200">
                              <SelectValue placeholder="Select project vertical" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl shadow-xl">
                            {projectVerticals.map((vertical) => (
                              <SelectItem
                                key={vertical}
                                value={vertical}
                                className="text-slate-700 dark:text-slate-300 py-3"
                              >
                                {vertical}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  {showProjectVerticalOther && (
                    <FormField
                      control={form.control}
                      name="project_vertical_other"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            Please name your project vertical{" "}
                            <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <FileText className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                              <Input
                                className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                placeholder="Enter your project vertical"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-500 dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="project_abstract_objective"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Project Abstract and Objective{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormDescription className="text-sm text-slate-500 dark:text-slate-400">
                          Please tell us more about the project and clearly
                          state its primary objectives and key use cases.
                          Explain how the solution enhances Avalanche's
                          capabilities and why it's well-suited for emerging
                          market conditions. (300 words limit)
                        </FormDescription>
                        <FormControl>
                          <div className="relative">
                            <FileText className="absolute left-4 top-4 w-5 h-5 text-slate-400 dark:text-slate-500" />
                            <Textarea
                              placeholder="Describe your project, its objectives, and key use cases..."
                              className="pl-12 pt-4 min-h-[120px] text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="technical_roadmap"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Technical Roadmap{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormDescription className="text-sm text-slate-500 dark:text-slate-400">
                          Please include a technical roadmap to outline the
                          various development stages involved in the project.
                          This roadmap should provide a clear timeline,
                          specifying the expected start and end dates for each
                          stage, as well as the key activities that will be
                          undertaken during each phase.
                        </FormDescription>
                        <FormControl>
                          <div className="relative">
                            <FileText className="absolute left-4 top-4 w-5 h-5 text-slate-400 dark:text-slate-500" />
                            <Textarea
                              placeholder="Outline your technical roadmap with timelines and key activities..."
                              className="pl-12 pt-4 min-h-[120px] text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="repositories_achievements"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Repositories and Achievements{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormDescription className="text-sm text-slate-500 dark:text-slate-400">
                          Provide evidence of prior accomplishments in
                          blockchain infrastructure and tooling, blockchain
                          software, AI tooling or related fields. (300 words
                          limit)
                        </FormDescription>
                        <FormControl>
                          <div className="relative">
                            <FileText className="absolute left-4 top-4 w-5 h-5 text-slate-400 dark:text-slate-500" />
                            <Textarea
                              placeholder="List your repositories and achievements in blockchain or AI fields..."
                              className="pl-12 pt-4 min-h-[120px] text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="risks_challenges"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Risks and Challenges{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormDescription className="text-sm text-slate-500 dark:text-slate-400">
                          Please provide key risks (technical, regulatory,
                          market, etc.), potential roadblocks and contingency
                          plans. (300 words limit)
                        </FormDescription>
                        <FormControl>
                          <div className="relative">
                            <FileText className="absolute left-4 top-4 w-5 h-5 text-slate-400 dark:text-slate-500" />
                            <Textarea
                              placeholder="Describe the risks, challenges, and contingency plans for your project..."
                              className="pl-12 pt-4 min-h-[120px] text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="project_company_github"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Project/Company GitHub{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Github className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                            <Input
                              className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              placeholder="https://github.com/your-project"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="company_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Project/Company Type{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={(value) => {
                              field.onChange(value);
                              setShowCompanyTypeOther(value === "Other");
                            }}
                            defaultValue={field.value}
                            className="flex flex-col space-y-3"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="No Registered Entity"
                                id="no-registered-entity"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="no-registered-entity"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                No Registered Entity
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="Solo Developer"
                                id="solo-developer"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="solo-developer"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                Solo Developer
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="Independent Development Team"
                                id="independent-development-team"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="independent-development-team"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                Independent Development Team
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="DAO"
                                id="dao"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="dao"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                DAO
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="Private Company"
                                id="private-company"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="private-company"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                Private Company
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="Public Company"
                                id="public-company"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="public-company"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                Public Company
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="Not for Profit"
                                id="not-for-profit"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="not-for-profit"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                Not for Profit
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="Other"
                                id="company-type-other"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="company-type-other"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                Other
                              </label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  {showCompanyTypeOther && (
                    <FormField
                      control={form.control}
                      name="company_type_other"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            How would you classify your business?{" "}
                            <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Info className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                              <Input
                                className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                placeholder="Please specify your company type"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-500 dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="project_company_hq"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Project/Company HQ{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200">
                              <SelectValue placeholder="Select country" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl shadow-xl">
                            {countries.map((country) => (
                              <SelectItem
                                key={country}
                                value={country}
                                className="text-slate-700 dark:text-slate-300 py-3"
                              >
                                {country}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="project_company_continent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Project/Company Continent{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200">
                              <SelectValue placeholder="Select continent" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl shadow-xl">
                            {continents.map((continent) => (
                              <SelectItem
                                key={continent}
                                value={continent}
                                className="text-slate-700 dark:text-slate-300 py-3"
                              >
                                {continent}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="project_company_website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Project/Company Website
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Link className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                            <Input
                              className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              placeholder="https://yourwebsite.com"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="project_company_x_handle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Project/Company X Handle
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <MessageSquare className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                            <Input
                              className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              placeholder="https://x.com/yourhandle"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="media_kit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Media Kit <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormDescription className="text-sm text-slate-500 dark:text-slate-400">
                          Please share a Google Drive folder link for your brand
                          guidelines, logos, and video/static assets that can be
                          used in social content. Ensure the folder is
                          accessible to anyone with the link.
                        </FormDescription>
                        <FormControl>
                          <div className="relative">
                            <Link className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                            <Input
                              className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                              placeholder="https://drive.google.com/drive/folders/your-folder-id"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="p-8 md:p-12 border-b border-slate-100 dark:border-slate-700">
                <SectionHeader
                  icon={
                    <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                  }
                  title="Financial Overview"
                  subtitle="Details about your funding history and needs"
                />
                <div className="space-y-8">
                  <FormField
                    control={form.control}
                    name="previous_avalanche_funding_grants"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Previous Avalanche Funding/Grants{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <div className="space-y-4">
                          {avalancheFundingTypes.map((type) => (
                            <div key={type}>
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={`funding-avalanche-${type}`}
                                  checked={field.value?.includes(type) || false}
                                  onCheckedChange={(checked) => {
                                    const currentValue = field.value || [];
                                    const newValue = checked
                                      ? [...currentValue, type]
                                      : currentValue.filter((v) => v !== type);
                                    field.onChange(newValue);
                                  }}
                                  className="border-slate-300 dark:border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                />
                                <label
                                  htmlFor={`funding-avalanche-${type}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700 dark:text-slate-300 cursor-pointer"
                                >
                                  {type}
                                </label>
                              </div>
                              {field.value?.includes(type) && type !== "No" && (
                                <div className="mt-2 pl-6">
                                  <FormField
                                    control={form.control}
                                    name={avalancheFundingAmountFields[type]}
                                    render={({ field: amountField }) => (
                                      <FormItem>
                                        <FormLabel className="text-xs text-slate-500 dark:text-slate-400">
                                          {type === "Other"
                                            ? "Share the name of the funding entity and amount funded."
                                            : `Amount for ${type}`}
                                        </FormLabel>
                                        <FormControl>
                                          {type === "Other" ? (
                                            <div className="relative">
                                              <FileText className="absolute left-3 top-3 w-4 h-4 text-slate-400 dark:text-slate-500" />
                                              <Textarea
                                                className="pl-9 pt-3 min-h-[80px] text-sm border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-md resize-none"
                                                placeholder="Share the name of the funding entity and amount funded"
                                                {...amountField}
                                                value={
                                                  typeof amountField.value ===
                                                  "string"
                                                    ? amountField.value
                                                    : ""
                                                }
                                              />
                                            </div>
                                          ) : (
                                            <div className="relative">
                                              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                                              <Input
                                                className="pl-9 h-10 text-sm border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-md"
                                                placeholder="Enter amount in USD"
                                                {...amountField}
                                                value={
                                                  typeof amountField.value ===
                                                  "string"
                                                    ? amountField.value
                                                    : ""
                                                }
                                              />
                                            </div>
                                          )}
                                        </FormControl>
                                        <FormMessage className="text-red-500 dark:text-red-400" />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="previous_funding"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Previous Funding (non Avalanche){" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <div className="space-y-4">
                          {nonAvalancheFundingTypes.map((type) => (
                            <div key={type}>
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id={`funding-non-avalanche-${type}`}
                                  checked={field.value?.includes(type) || false}
                                  onCheckedChange={(checked) => {
                                    const currentValue = field.value || [];
                                    const newValue = checked
                                      ? [...currentValue, type]
                                      : currentValue.filter((v) => v !== type);
                                    field.onChange(newValue);
                                  }}
                                  className="border-slate-300 dark:border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                />
                                <label
                                  htmlFor={`funding-non-avalanche-${type}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700 dark:text-slate-300 cursor-pointer"
                                >
                                  {type}
                                </label>
                              </div>
                              {field.value?.includes(type) &&
                                type !== "No Funding" &&
                                type !== "Self-Funding" &&
                                type !== "Family & Friends" && (
                                  <div className="mt-2 pl-6">
                                    <FormField
                                      control={form.control}
                                      name={
                                        nonAvalancheFundingAmountFields[type]
                                      }
                                      render={({ field: amountField }) => (
                                        <FormItem>
                                          <FormLabel className="text-xs text-slate-500 dark:text-slate-400">
                                            Amount for {type}
                                          </FormLabel>
                                          <FormControl>
                                            <div className="relative">
                                              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                                              <Input
                                                className="pl-9 h-10 text-sm border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-md"
                                                placeholder="Enter amount in USD"
                                                {...amountField}
                                                value={
                                                  typeof amountField.value ===
                                                  "string"
                                                    ? amountField.value
                                                    : ""
                                                }
                                              />
                                            </div>
                                          </FormControl>
                                          <FormMessage className="text-red-500 dark:text-red-400" />
                                        </FormItem>
                                      )}
                                    />
                                  </div>
                                )}
                            </div>
                          ))}
                        </div>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="p-8 md:p-12 border-b border-slate-100 dark:border-slate-700">
                <SectionHeader
                  icon={
                    <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  }
                  title="Grant Information"
                  subtitle="Details about your grant request"
                />
                <div className="space-y-8">
                  <FormField
                    control={form.control}
                    name="requested_funding_range"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Requested Funding Range{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-3"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="$1-$24,999"
                                id="1-24999"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="1-24999"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                $1-$24,999
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="$25,000-$49,999"
                                id="25000-49999"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="25000-49999"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                $25,000-$49,999
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="$50,000-$99,999"
                                id="50000-99999"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="50000-99999"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                $50,000-$99,999
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="$100,000-$199,999"
                                id="100000-199999"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="100000-199999"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                $100,000-$199,999
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="$200,000+"
                                id="200000-plus"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="200000-plus"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                $200,000+
                              </label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="eligibility_and_metrics"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Retro9000 Eligibility and Quantitative Metrics{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormDescription className="text-sm text-slate-500 dark:text-slate-400">
                          Explain why your project is eligible (e.g., live
                          Avalanche L1, infrastructure for L1s, cross-chain
                          swaps via ICM, etc.) and provide relevant quantitative
                          metrics (e.g., validators, transaction volume, TVL,
                          monthly active users, etc.). Please provide proof like
                          explorer, contract, or GitHub links.
                        </FormDescription>
                        <FormControl>
                          <div className="relative">
                            <FileText className="absolute left-4 top-4 w-5 h-5 text-slate-400 dark:text-slate-500" />
                            <Textarea
                              placeholder="Explain your project's eligibility and provide key metrics..."
                              className="pl-12 pt-4 min-h-[120px] text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="requested_grant_size_budget"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Requested Grant Size & Budget{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <DollarSign className="absolute left-4 top-4 w-5 h-5 text-slate-400 dark:text-slate-500" />
                            <Textarea
                              placeholder="Specify the grant amount requested and provide a budget breakdown..."
                              className="pl-12 pt-4 min-h-[120px] text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="previous_retro9000_funding"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Have you received funding from a previous Retro9000
                          snapshot? <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={(value) => {
                              field.onChange(value);
                              setShowRetro9000Changes(value === "Yes");
                            }}
                            defaultValue={field.value}
                            className="flex flex-col space-y-3"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="Yes"
                                id="retro9000-yes"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="retro9000-yes"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                Yes
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="No"
                                id="retro9000-no"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="retro9000-no"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                No
                              </label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  {showRetro9000Changes && (
                    <FormField
                      control={form.control}
                      name="retro9000_previous_funding_amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            Retro9000 Previous Funding Amount{" "}
                            <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <DollarSign className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                              <Input
                                className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                placeholder="e.g. 50,000"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-500 dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                  )}

                  {showRetro9000Changes && (
                    <FormField
                      control={form.control}
                      name="retro9000_changes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            What has changed since the last Retro9000 snapshot
                            you participated in?{" "}
                            <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormDescription className="text-sm text-slate-500 dark:text-slate-400">
                            E.g., new developments, increased impact, adoption
                            growth, changes in scope, number of validators,
                            transaction volume, ICM messages, TVL, DEX volumes,
                            monthly active users, etc.
                          </FormDescription>
                          <FormControl>
                            <div className="relative">
                              <FileText className="absolute left-4 top-4 w-5 h-5 text-slate-400 dark:text-slate-500" />
                              <Textarea
                                placeholder="Describe what has changed since your last Retro9000 participation..."
                                className="pl-12 pt-4 min-h-[120px] text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-500 dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="vc_fundraising_support_check"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Support with venture capital fundraising?{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormDescription className="text-sm text-slate-500 dark:text-slate-400">
                          Please indicate if you require assistance with venture
                          capital fundraising
                        </FormDescription>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200">
                              <SelectValue placeholder="Select an option" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl shadow-xl">
                            <SelectItem
                              value="Yes"
                              className="text-slate-700 dark:text-slate-300 py-3"
                            >
                              Yes
                            </SelectItem>
                            <SelectItem
                              value="No"
                              className="text-slate-700 dark:text-slate-300 py-3"
                            >
                              No
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="p-8 md:p-12 border-b border-slate-100 dark:border-slate-700">
                <SectionHeader
                  icon={
                    <Globe className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  }
                  title="Contribution to the Avalanche Ecosystem"
                  subtitle="Details about your project's impact on Avalanche"
                />
                <div className="space-y-8">
                  <FormField
                    control={form.control}
                    name="multichain_check"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Multichain <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={(value) => {
                              field.onChange(value);
                              setShowMultichainDetails(value === "Yes");
                            }}
                            defaultValue={field.value}
                            className="flex flex-col space-y-3"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="Yes"
                                id="multichain-yes"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="multichain-yes"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                Yes
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="No"
                                id="multichain-no"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="multichain-no"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                No
                              </label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  {showMultichainDetails && (
                    <FormField
                      control={form.control}
                      name="multichain_chains"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            If you chose "Yes," please share which chain(s).{" "}
                            <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Link className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                              <Input
                                className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                placeholder="e.g., Ethereum, Solana, Polygon"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-500 dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="current_development_stage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Current Development Stage{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormDescription className="text-sm text-slate-500 dark:text-slate-400">
                          Please share where you are in the development process.
                        </FormDescription>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200">
                              <SelectValue placeholder="Select development stage" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl shadow-xl">
                            <SelectItem
                              value="Early-Stage (idea, Proof of Concept, prototype development)"
                              className="text-slate-700 dark:text-slate-300 py-3"
                            >
                              Early-Stage (idea, Proof of Concept, prototype
                              development)
                            </SelectItem>
                            <SelectItem
                              value="Mid-Stage (product on testnet, closed beta)"
                              className="text-slate-700 dark:text-slate-300 py-3"
                            >
                              Mid-Stage (product on testnet, closed beta)
                            </SelectItem>
                            <SelectItem
                              value="Late-Stage (product live with onchain metrics)"
                              className="text-slate-700 dark:text-slate-300 py-3"
                            >
                              Late-Stage (product live with onchain metrics)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="project_work_duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          How long have you been working on this project?{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200">
                              <SelectValue placeholder="Select duration" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl shadow-xl">
                            <SelectItem
                              value="0-3 months"
                              className="text-slate-700 dark:text-slate-300 py-3"
                            >
                              0-3 months
                            </SelectItem>
                            <SelectItem
                              value="4-6 months"
                              className="text-slate-700 dark:text-slate-300 py-3"
                            >
                              4-6 months
                            </SelectItem>
                            <SelectItem
                              value="7-12 months"
                              className="text-slate-700 dark:text-slate-300 py-3"
                            >
                              7-12 months
                            </SelectItem>
                            <SelectItem
                              value="1-2 years"
                              className="text-slate-700 dark:text-slate-300 py-3"
                            >
                              1-2 years
                            </SelectItem>
                            <SelectItem
                              value="2+ years"
                              className="text-slate-700 dark:text-slate-300 py-3"
                            >
                              2+ years
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="project_live_status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Project live status{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200">
                              <SelectValue placeholder="Select project status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl shadow-xl">
                            <SelectItem
                              value="Not Live"
                              className="text-slate-700 dark:text-slate-300 py-3"
                            >
                              Not Live
                            </SelectItem>
                            <SelectItem
                              value="Live on Testnet"
                              className="text-slate-700 dark:text-slate-300 py-3"
                            >
                              Live on Testnet
                            </SelectItem>
                            <SelectItem
                              value="Live on Mainnet"
                              className="text-slate-700 dark:text-slate-300 py-3"
                            >
                              Live on Mainnet
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="first_build_avalanche"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Is this your first time building on Avalanche?{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-3"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="Yes"
                                id="first-build-yes"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="first-build-yes"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                Yes
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="No"
                                id="first-build-no"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="first-build-no"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                No
                              </label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  {showPreviousProjectDetails && (
                    <FormField
                      control={form.control}
                      name="previous_avalanche_project_info"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            Please share information about your previous
                            Avalanche project(s){" "}
                            <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <FileText className="absolute left-4 top-4 w-5 h-5 text-slate-400 dark:text-slate-500" />
                              <Textarea
                                placeholder="Describe your previous Avalanche projects..."
                                className="pl-12 pt-4 min-h-[120px] text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-500 dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="avalanche_contribution"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          How does your project contribute to the Avalanche
                          ecosystem? <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormDescription className="text-sm text-slate-500 dark:text-slate-400">
                          Maximum 200 words
                        </FormDescription>
                        <FormControl>
                          <div className="relative">
                            <FileText className="absolute left-4 top-4 w-5 h-5 text-slate-400 dark:text-slate-500" />
                            <Textarea
                              placeholder="Describe how your project contributes to the Avalanche ecosystem..."
                              className="pl-12 pt-4 min-h-[120px] text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="avalanche_benefit_check"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Would any existing Avalanche projects/L1s benefit from
                          your proposal being implemented?{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-3"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="Yes"
                                id="benefit-yes"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="benefit-yes"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                Yes
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="No"
                                id="benefit-no"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="benefit-no"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                No
                              </label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  {showBenefitDetails && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="avalanche_l1_project_benefited_1_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                                Avalanche L1 / Project Name 1{" "}
                                <span className="text-red-500">*</span>
                              </FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Building2 className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                  <Input
                                    className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                    placeholder="Enter Avalanche L1 / Project name"
                                    {...field}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage className="text-red-500 dark:text-red-400" />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="avalanche_l1_project_benefited_1_website"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                                Avalanche L1 / Project Website 1
                              </FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Link className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                  <Input
                                    className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                    placeholder="https://website.com"
                                    {...field}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage className="text-red-500 dark:text-red-400" />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="avalanche_l1_project_benefited_2_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                                Avalanche L1 / Project Name 2
                              </FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Building2 className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                  <Input
                                    className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                    placeholder="Enter Avalanche L1 / Project name"
                                    {...field}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage className="text-red-500 dark:text-red-400" />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="avalanche_l1_project_benefited_2_website"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                                Avalanche L1 / Project Website 2
                              </FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Link className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                  <Input
                                    className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                    placeholder="https://website.com"
                                    {...field}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage className="text-red-500 dark:text-red-400" />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="similar_project_check"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Are there similar projects to yours?{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-3"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="Yes"
                                id="similar-yes"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="similar-yes"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                Yes
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="No"
                                id="similar-no"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="similar-no"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                No
                              </label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  {showSimilarProjects && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="similar_project_name_1"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                                Similar Project Name 1{" "}
                                <span className="text-red-500">*</span>
                              </FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Building2 className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                  <Input
                                    className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                    placeholder="Enter similar project name"
                                    {...field}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage className="text-red-500 dark:text-red-400" />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="similar_project_website_1"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                                Similar Project Website 1
                              </FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Link className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                  <Input
                                    className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                    placeholder="https://website.com"
                                    {...field}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage className="text-red-500 dark:text-red-400" />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="similar_project_name_2"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                                Similar Project Name 2
                              </FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Building2 className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                  <Input
                                    className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                    placeholder="Enter similar project name"
                                    {...field}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage className="text-red-500 dark:text-red-400" />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="similar_project_website_2"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                                Similar Project Website 2
                              </FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Link className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                  <Input
                                    className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                    placeholder="https://website.com"
                                    {...field}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage className="text-red-500 dark:text-red-400" />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="direct_competitor_check"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Are there direct competitors to your project?{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-3"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="Yes"
                                id="competitor-yes"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="competitor-yes"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                Yes
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="No"
                                id="competitor-no"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="competitor-no"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                No
                              </label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  {showCompetitors && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="direct_competitor_1_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                                Competitor Name 1{" "}
                                <span className="text-red-500">*</span>
                              </FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Building2 className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                  <Input
                                    className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                    placeholder="Enter competitor name"
                                    {...field}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage className="text-red-500 dark:text-red-400" />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="direct_competitor_1_website"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                                Competitor Website 1
                              </FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Link className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                  <Input
                                    className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                    placeholder="https://website.com"
                                    {...field}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage className="text-red-500 dark:text-red-400" />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="direct_competitor_2_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                                Competitor Name 2
                              </FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Building2 className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                  <Input
                                    className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                    placeholder="Enter competitor name"
                                    {...field}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage className="text-red-500 dark:text-red-400" />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="direct_competitor_2_website"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                                Competitor Website 2
                              </FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Link className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                  <Input
                                    className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                    placeholder="https://website.com"
                                    {...field}
                                  />
                                </div>
                              </FormControl>
                              <FormMessage className="text-red-500 dark:text-red-400" />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  <FormField
                    control={form.control}
                    name="token_launch_avalanche_check"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Are you planning to launch a token on Avalanche?{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex flex-col space-y-3"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="Yes"
                                id="token-launch-yes"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="token-launch-yes"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                Yes
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="No"
                                id="token-launch-no"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="token-launch-no"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                No
                              </label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  {showTokenLaunchDetails && (
                    <FormField
                      control={form.control}
                      name="token_launch_other_explanation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            What chain(s) will you launch your token on and why?{" "}
                            <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <FileText className="absolute left-4 top-4 w-5 h-5 text-slate-400 dark:text-slate-500" />
                              <Textarea
                                placeholder="Specify which chain(s) you plan to launch on and explain your reasoning..."
                                className="pl-12 pt-4 min-h-[120px] text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-500 dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="open_source_check"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Is your project open source?{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200">
                              <SelectValue placeholder="Select open source status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl shadow-xl">
                            <SelectItem
                              value="Yes"
                              className="text-slate-700 dark:text-slate-300 py-3"
                            >
                              Yes
                            </SelectItem>
                            <SelectItem
                              value="No"
                              className="text-slate-700 dark:text-slate-300 py-3"
                            >
                              No
                            </SelectItem>
                            <SelectItem
                              value="Partially"
                              className="text-slate-700 dark:text-slate-300 py-3"
                            >
                              Partially
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="p-8 md:p-12 border-b border-slate-100 dark:border-slate-700">
                <SectionHeader
                  icon={
                    <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  }
                  title="Team Details"
                  subtitle="Tell us about your team"
                />
                <div className="space-y-8">
                  <FormField
                    control={form.control}
                    name="team_size"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Team Size <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={(value) => {
                              field.onChange(value);
                              setShowTeamMembers(value !== "1" && value !== "");
                            }}
                            defaultValue={field.value}
                            className="flex flex-col space-y-3"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="1"
                                id="team-size-1"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="team-size-1"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                1
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="2-5"
                                id="team-size-2-5"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="team-size-2-5"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                2-5
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="6-10"
                                id="team-size-6-10"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="team-size-6-10"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                6-10
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="10+"
                                id="team-size-10-plus"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="team-size-10-plus"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                10+
                              </label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  {showTeamMembers && (
                    <div className="mt-8 space-y-8">
                      <div>
                        <h3 className="text-lg font-medium mb-2 text-slate-700 dark:text-slate-300">
                          Team Members
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                          Please add two more team members other than the main
                          applicant if applicable. Demonstrate the team's
                          technical prowess and track record, ensuring they can
                          deliver on their vision.
                        </p>
                      </div>

                      <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                        <h3 className="text-md font-medium mb-4 text-slate-700 dark:text-slate-300">
                          Member 1:
                        </h3>

                        <div className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                              control={form.control}
                              name="team_member_1_first_name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                                    First Name{" "}
                                    <span className="text-red-500">*</span>
                                  </FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                      <Input
                                        className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                        placeholder="First name"
                                        {...field}
                                      />
                                    </div>
                                  </FormControl>
                                  <FormMessage className="text-red-500 dark:text-red-400" />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="team_member_1_last_name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                                    Last Name{" "}
                                    <span className="text-red-500">*</span>
                                  </FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                      <Input
                                        className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                        placeholder="Last name"
                                        {...field}
                                      />
                                    </div>
                                  </FormControl>
                                  <FormMessage className="text-red-500 dark:text-red-400" />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={form.control}
                            name="team_member_1_email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                                  Email <span className="text-red-500">*</span>
                                </FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                    <Input
                                      className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                      placeholder="email@example.com"
                                      type="email"
                                      {...field}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage className="text-red-500 dark:text-red-400" />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="team_member_1_x_account"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                                  X <span className="text-red-500">*</span>
                                </FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <MessageSquare className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                    <Input
                                      className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                      placeholder="https://x.com/username"
                                      {...field}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage className="text-red-500 dark:text-red-400" />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="team_member_1_telegram"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                                  Telegram{" "}
                                  <span className="text-red-500">*</span>
                                </FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <MessageSquare className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                    <Input
                                      className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                      placeholder="t.me/username"
                                      {...field}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage className="text-red-500 dark:text-red-400" />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="team_member_1_linkedin"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                                  LinkedIn
                                </FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Linkedin className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                    <Input
                                      className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                      placeholder="linkedin.com/in/username/"
                                      {...field}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage className="text-red-500 dark:text-red-400" />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="team_member_1_github"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                                  GitHub
                                </FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Github className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                    <Input
                                      className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                      placeholder="https://github.com/username"
                                      {...field}
                                      value={
                                        typeof field.value === "string"
                                          ? field.value
                                          : ""
                                      }
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage className="text-red-500 dark:text-red-400" />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="team_member_1_other"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                                  Other
                                </FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Info className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                    <Input
                                      className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                      placeholder="Other resources or links"
                                      {...field}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage className="text-red-500 dark:text-red-400" />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="team_member_1_bio"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                                  Bio <span className="text-red-500">*</span>
                                </FormLabel>
                                <FormDescription className="text-sm text-slate-500 dark:text-slate-400">
                                  100 words limit
                                </FormDescription>
                                <FormControl>
                                  <div className="relative">
                                    <BookUser className="absolute left-4 top-4 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                    <Textarea
                                      placeholder="Provide a brief bio for the team member"
                                      className="pl-12 pt-4 min-h-[150px] text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                                      {...field}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage className="text-red-500 dark:text-red-400" />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                        <h3 className="text-md font-medium mb-4 text-slate-700 dark:text-slate-300">
                          Member 2:
                        </h3>

                        <div className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                              control={form.control}
                              name="team_member_2_first_name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                                    First Name
                                  </FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                      <Input
                                        className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                        placeholder="First name"
                                        {...field}
                                      />
                                    </div>
                                  </FormControl>
                                  <FormMessage className="text-red-500 dark:text-red-400" />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="team_member_2_last_name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                                    Last Name
                                  </FormLabel>
                                  <FormControl>
                                    <div className="relative">
                                      <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                      <Input
                                        className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                        placeholder="Last name"
                                        {...field}
                                      />
                                    </div>
                                  </FormControl>
                                  <FormMessage className="text-red-500 dark:text-red-400" />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={form.control}
                            name="team_member_2_email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                                  Email
                                </FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                    <Input
                                      className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                      placeholder="email@example.com"
                                      type="email"
                                      {...field}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage className="text-red-500 dark:text-red-400" />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="team_member_2_x_account"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                                  X
                                </FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <MessageSquare className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                    <Input
                                      className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                      placeholder="https://x.com/username"
                                      {...field}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage className="text-red-500 dark:text-red-400" />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="team_member_2_telegram"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                                  Telegram
                                </FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <MessageSquare className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                    <Input
                                      className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                      placeholder="t.me/username"
                                      {...field}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage className="text-red-500 dark:text-red-400" />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="team_member_2_linkedin"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                                  LinkedIn
                                </FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Linkedin className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                    <Input
                                      className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                      placeholder="linkedin.com/in/username/"
                                      {...field}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage className="text-red-500 dark:text-red-400" />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="team_member_2_github"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                                  GitHub
                                </FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Github className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                    <Input
                                      className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                      placeholder="https://github.com/username"
                                      {...field}
                                      value={
                                        typeof field.value === "string"
                                          ? field.value
                                          : ""
                                      }
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage className="text-red-500 dark:text-red-400" />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="team_member_2_other"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                                  Other
                                </FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Info className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                    <Input
                                      className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                      placeholder="Other resources or links"
                                      {...field}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage className="text-red-500 dark:text-red-400" />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="team_member_2_bio"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                                  Bio
                                </FormLabel>
                                <FormDescription className="text-sm text-slate-500 dark:text-slate-400">
                                  100 words limit
                                </FormDescription>
                                <FormControl>
                                  <div className="relative">
                                    <BookUser className="absolute left-4 top-4 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                    <Textarea
                                      placeholder="Provide a brief bio for the team member"
                                      className="pl-12 pt-4 min-h-[150px] text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                                      {...field}
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage className="text-red-500 dark:text-red-400" />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-8 md:p-12 border-b border-slate-100 dark:border-slate-700">
                <SectionHeader
                  icon={
                    <Info className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  }
                  title="Other"
                  subtitle="Miscellaneous information"
                />
                <div className="space-y-8">
                  <FormField
                    control={form.control}
                    name="avalanche_grant_source"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          How did you hear about the Grant Program?{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            setShowGrantSource(value === "Other");
                          }}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200">
                              <SelectValue placeholder="Select an option" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl shadow-xl">
                            <SelectItem
                              value="Avalanche Website"
                              className="text-slate-700 dark:text-slate-300 py-3"
                            >
                              Avalanche Website
                            </SelectItem>
                            <SelectItem
                              value="Avalanche Forum"
                              className="text-slate-700 dark:text-slate-300 py-3"
                            >
                              Avalanche Forum
                            </SelectItem>
                            <SelectItem
                              value="Twitter/X"
                              className="text-slate-700 dark:text-slate-300 py-3"
                            >
                              Twitter/X
                            </SelectItem>
                            <SelectItem
                              value="Telegram"
                              className="text-slate-700 dark:text-slate-300 py-3"
                            >
                              Telegram
                            </SelectItem>
                            <SelectItem
                              value="LinkedIn"
                              className="text-slate-700 dark:text-slate-300 py-3"
                            >
                              LinkedIn
                            </SelectItem>
                            <SelectItem
                              value="Livestream"
                              className="text-slate-700 dark:text-slate-300 py-3"
                            >
                              Livestream
                            </SelectItem>
                            <SelectItem
                              value="The Arena"
                              className="text-slate-700 dark:text-slate-300 py-3"
                            >
                              The Arena
                            </SelectItem>
                            <SelectItem
                              value="Email"
                              className="text-slate-700 dark:text-slate-300 py-3"
                            >
                              Email
                            </SelectItem>
                            <SelectItem
                              value="Word of Mouth"
                              className="text-slate-700 dark:text-slate-300 py-3"
                            >
                              Word of Mouth
                            </SelectItem>
                            <SelectItem
                              value="Event"
                              className="text-slate-700 dark:text-slate-300 py-3"
                            >
                              Event
                            </SelectItem>
                            <SelectItem
                              value="Other"
                              className="text-slate-700 dark:text-slate-300 py-3"
                            >
                              Other
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />
                  {showGrantSource && (
                    <FormField
                      control={form.control}
                      name="avalanche_grant_source_other"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            Please specify{" "}
                            <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Info className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                              <Input
                                className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                placeholder="Please specify how you heard about the program"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-500 dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="program_referral_check"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Were you referred to this program?{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={(value) => {
                              field.onChange(value);
                              setShowReferrer(value === "Yes");
                            }}
                            defaultValue={field.value}
                            className="flex flex-col space-y-3"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="Yes"
                                id="referrer-yes"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="referrer-yes"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                Yes
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem
                                value="No"
                                id="referrer-no"
                                className="h-5 w-5"
                              />
                              <label
                                htmlFor="referrer-no"
                                className="text-slate-700 dark:text-slate-300"
                              >
                                No
                              </label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />

                  {showReferrer && (
                    <FormField
                      control={form.control}
                      name="program_referrer"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            Please provide the name of the person who referred
                            you <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                              <Input
                                className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                placeholder="Enter referrer's name"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-500 dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>

              <div className="p-8 md:p-12">
                <SectionHeader
                  icon={
                    <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
                  }
                  title="Consent & Privacy"
                  subtitle="Please review and agree to the terms"
                />
                <div className="space-y-6">
                  <FormField
                    control={form.control}
                    name="kyb_willing"
                    render={({ field }) => (
                      <FormItem className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/50 p-6">
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                          Is your team willing to KYB?{" "}
                          <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormDescription className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                          If not, you will not be eligible to receive Retro9000
                          funding.
                        </FormDescription>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            className="flex items-start space-x-4 mt-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="Yes" id="kyb-yes" />
                              <label htmlFor="kyb-yes">Yes</label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="No" id="kyb-no" />
                              <label htmlFor="kyb-no">No</label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gdpr"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-4 space-y-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/50 p-6">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="border-slate-300 dark:border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 mt-1"
                          />
                        </FormControl>
                        <div className="space-y-2 leading-none">
                          <FormLabel className="font-medium text-slate-700 dark:text-slate-300 text-base cursor-pointer">
                            I agree to the Privacy Policy{" "}
                            <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormDescription className="text-sm text-slate-500 dark:text-slate-400">
                            By checking this box, you agree and authorize the
                            Avalanche Foundation to utilize artificial
                            intelligence systems to process the information in
                            your application. For more details, please refer to
                            our{" "}
                            <a
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline font-medium transition-colors"
                              href="https://www.avax.network/privacy-policy"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Privacy Policy
                            </a>
                            .
                          </FormDescription>
                        </div>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="marketing_consent"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-4 space-y-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/50 p-6">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="border-slate-300 dark:border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600 mt-1"
                          />
                        </FormControl>
                        <div className="space-y-2 leading-none">
                          <FormLabel className="font-medium text-slate-700 dark:text-slate-300 text-base cursor-pointer">
                            I would like to receive marketing emails from the
                            Avalanche Foundation
                          </FormLabel>
                          <FormDescription className="text-sm text-slate-500 dark:text-slate-400">
                            Check this box to stay up to date with all things
                            Avalanche. You can unsubscribe anytime.
                          </FormDescription>
                        </div>
                        <FormMessage className="text-red-500 dark:text-red-400" />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="pt-8 flex justify-center gap-4">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-8 py-3 text-base font-medium bg-[#FF394A] hover:bg-[#e6333f] text-white rounded-lg transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                        Submitting Application...
                      </>
                    ) : (
                      <>
                        Submit Application
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </div>
      )}
    </div>
  );
}
