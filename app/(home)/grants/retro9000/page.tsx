"use client";

import Image from "next/image";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Loader2,
  Mail,
  User,
  Building2,
  FileText,
  Globe,
  MessageSquare,
  Github,
  DollarSign,
  Users,
  TrendingUp,
  Shield,
  Check,
  ArrowRight,
  Rocket,
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

const formSchema = z.object({
  // Applicant Information
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  email: z.string().email("Please enter a valid email"),
  telegram: z.string().min(1, "Telegram handle is required"),
  xProfile: z.string().min(1, "X profile is required"),
  // Project Information
  projectName: z.string().min(1, "Project name is required"),
  projectWebsite: z.string().url("Please enter a valid URL"),
  projectXHandle: z.string().min(1, "X handle is required"),
  projectGitHub: z.string().min(1, "GitHub repository is required"),
  projectDescription: z
    .string()
    .min(10, "Please provide a more detailed description"),
  projectType: z.string().min(1, "Project type is required"),
  competitors: z.string().min(1, "Please list your competitors"),
  eligibilityReason: z
    .string()
    .min(10, "Please explain why your project is eligible"),
  // Token Information
  hasToken: z.boolean().optional(),
  tokenOnAvalanche: z.boolean().optional(),
  // Grant Information
  grantSize: z
    .string()
    .min(10, "Please provide details about your requested grant size"),
  userOnboarding: z
    .string()
    .min(1, "Please provide an estimate of users/builders"),
  networkKPIs: z
    .string()
    .min(10, "Please describe the KPIs your project will bring"),
  // Previous Funding
  previousFunding: z.string().min(1, "Please select an option"),
  fundingAmount: z.string().optional(),
  additionalValue: z.string().optional(),
  // Team Information
  teamBackground: z
    .string()
    .min(10, "Please provide background about your team"),
  willingToKYB: z.boolean().optional(),
  // Required consent fields
  privacyPolicyRead: z.boolean().refine((val) => val === true, {
    message: "You must agree to the privacy policy to submit the form",
  }),
  marketingConsent: z.boolean().optional(),
});

const HUBSPOT_FIELD_MAPPING = {
  firstName: "firstname",
  lastName: "lastname",
  email: "email",
  projectName: "0-2/project",
  projectWebsite: "0-2/website",
  projectXHandle: "0-2/twitterhandle",
  projectGitHub: "0-2/link_github",
  projectDescription: "0-2/project_description",
  projectType: "0-2/project_vertical",
  competitors: "0-2/company_competitors",
  eligibilityReason: "0-2/company_whyyou",
  hasToken: "0-2/launching_token",
  tokenOnAvalanche: "0-2/token_launch_on_avalanche",
  grantSize: "0-2/grant_size_and_budget_breakdown",
  userOnboarding: "0-2/new_user_onboard_number",
  networkKPIs: "0-2/project_kpi",
  previousFunding: "0-2/ava_funding_check",
  fundingAmount: "0-2/ava_funding_amount",
  additionalValue: "0-2/retro9000_additional_value_or_features",
  teamBackground: "0-2/team_background",
  willingToKYB: "0-2/kyb_willingness",
  telegram: "telegram_handle",
  xProfile: "twitterhandle",
  privacyPolicyRead: "gdpr",
  marketingConsent: "marketing_consent",
};

export default function GrantsForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<
    "success" | "error" | null
  >(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      telegram: "",
      xProfile: "",
      projectName: "",
      projectWebsite: "",
      projectXHandle: "",
      projectGitHub: "",
      projectDescription: "",
      projectType: "",
      competitors: "",
      eligibilityReason: "",
      hasToken: false,
      tokenOnAvalanche: false,
      grantSize: "",
      userOnboarding: "",
      networkKPIs: "",
      previousFunding: "",
      fundingAmount: "",
      additionalValue: "",
      teamBackground: "",
      willingToKYB: false,
      privacyPolicyRead: false,
      marketingConsent: false,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      const hubspotFormData: Record<string, string | number | boolean> = {};
      Object.entries(values).forEach(([key, value]) => {
        const hubspotFieldName =
          HUBSPOT_FIELD_MAPPING[key as keyof typeof HUBSPOT_FIELD_MAPPING] ||
          key;
        if (
          value === "" &&
          key !== "firstName" &&
          key !== "email" &&
          !key.includes("required")
        ) {
          return;
        }
        if (typeof value === "boolean") {
          if (key !== "privacyPolicyRead" && key !== "marketingConsent") {
            hubspotFormData[hubspotFieldName] = value ? "Yes" : "No";
          } else {
            hubspotFormData[hubspotFieldName] = value;
          }
        } else {
          hubspotFormData[hubspotFieldName] = value;
        }
      });

      console.log("HubSpot form data after mapping:", hubspotFormData);

      const response = await fetch("/api/retro9000", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(hubspotFormData),
      });

      console.log("API Response status:", response.status);
      const result = await response.json();
      console.log("API Response data:", result);

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to submit to HubSpot");
      }

      setSubmissionStatus("success");
      form.reset();
    } catch (error) {
      setSubmissionStatus("error");
      alert(
        `Error submitting application: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header Section */}
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
                setSubmissionStatus(null);
                form.reset();
              }}
              className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white px-8 py-3 text-lg font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              Submit Another Application
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-0"
              >
                {/* Applicant Information */}
                <div className="p-8 md:p-12 border-b border-slate-100 dark:border-slate-700">
                  <div className="space-y-2 mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          Applicant Information
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Tell us about yourself
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="firstName"
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
                        name="lastName"
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
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            Email Address{" "}
                            <span className="text-red-500">*</span>
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
                                  placeholder="@username"
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
                        name="xProfile"
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
                                  placeholder="@username"
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

                {/* Project Information */}
                <div className="p-8 md:p-12 border-b border-slate-100 dark:border-slate-700">
                  <div className="space-y-2 mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          Project Information
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Tell us about your project
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <FormField
                      control={form.control}
                      name="projectName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            Project Name <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Building2 className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                              <Input
                                className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                placeholder="Your project name"
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
                        name="projectWebsite"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                              Project Website{" "}
                              <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Globe className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                <Input
                                  className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                  placeholder="https://your-website.com"
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
                        name="projectXHandle"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                              Project X Handle{" "}
                              <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <MessageSquare className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                <Input
                                  className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                  placeholder="@projecthandle"
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
                      name="projectGitHub"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            Project GitHub{" "}
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
                      name="projectDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            Project Description{" "}
                            <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <FileText className="absolute left-4 top-4 w-5 h-5 text-slate-400 dark:text-slate-500" />
                              <Textarea
                                placeholder="Describe your project, its goals, and expected impact..."
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
                      name="projectType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            Project Type <span className="text-red-500">*</span>
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200">
                                <SelectValue placeholder="Select project type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl shadow-xl">
                              <SelectItem
                                value="validator-marketplaces"
                                className="text-slate-700 dark:text-slate-300 py-3"
                              >
                                Validator Marketplaces
                              </SelectItem>
                              <SelectItem
                                value="virtual-machines"
                                className="text-slate-700 dark:text-slate-300 py-3"
                              >
                                Virtual Machines
                              </SelectItem>
                              <SelectItem
                                value="wallets"
                                className="text-slate-700 dark:text-slate-300 py-3"
                              >
                                Wallets
                              </SelectItem>
                              <SelectItem
                                value="oracles"
                                className="text-slate-700 dark:text-slate-300 py-3"
                              >
                                Oracles
                              </SelectItem>
                              <SelectItem
                                value="interoperability-tools"
                                className="text-slate-700 dark:text-slate-300 py-3"
                              >
                                Interoperability Tools
                              </SelectItem>
                              <SelectItem
                                value="cryptography"
                                className="text-slate-700 dark:text-slate-300 py-3"
                              >
                                Cryptography
                              </SelectItem>
                              <SelectItem
                                value="bridges"
                                className="text-slate-700 dark:text-slate-300 py-3"
                              >
                                Bridges
                              </SelectItem>
                              <SelectItem
                                value="explorers"
                                className="text-slate-700 dark:text-slate-300 py-3"
                              >
                                Explorers
                              </SelectItem>
                              <SelectItem
                                value="rpcs"
                                className="text-slate-700 dark:text-slate-300 py-3"
                              >
                                RPCs
                              </SelectItem>
                              <SelectItem
                                value="data-storage"
                                className="text-slate-700 dark:text-slate-300 py-3"
                              >
                                Data Storage
                              </SelectItem>
                              <SelectItem
                                value="indexers"
                                className="text-slate-700 dark:text-slate-300 py-3"
                              >
                                Indexers
                              </SelectItem>
                              <SelectItem
                                value="token-engineering"
                                className="text-slate-700 dark:text-slate-300 py-3"
                              >
                                Token Engineering
                              </SelectItem>
                              <SelectItem
                                value="on-and-offramps"
                                className="text-slate-700 dark:text-slate-300 py-3"
                              >
                                On & Offramps
                              </SelectItem>
                              <SelectItem
                                value="defi"
                                className="text-slate-700 dark:text-slate-300 py-3"
                              >
                                DeFi
                              </SelectItem>
                              <SelectItem
                                value="gaming"
                                className="text-slate-700 dark:text-slate-300 py-3"
                              >
                                Gaming
                              </SelectItem>
                              <SelectItem
                                value="rwas-institutional"
                                className="text-slate-700 dark:text-slate-300 py-3"
                              >
                                RWAs/Institutional
                              </SelectItem>
                              <SelectItem
                                value="culture-nfts"
                                className="text-slate-700 dark:text-slate-300 py-3"
                              >
                                Culture/NFTs
                              </SelectItem>
                              <SelectItem
                                value="enterprise"
                                className="text-slate-700 dark:text-slate-300 py-3"
                              >
                                Enterprise
                              </SelectItem>
                              <SelectItem
                                value="exchanges-wallets"
                                className="text-slate-700 dark:text-slate-300 py-3"
                              >
                                Exchanges/Wallets
                              </SelectItem>
                              <SelectItem
                                value="payments"
                                className="text-slate-700 dark:text-slate-300 py-3"
                              >
                                Payments
                              </SelectItem>
                              <SelectItem
                                value="ai"
                                className="text-slate-700 dark:text-slate-300 py-3"
                              >
                                AI
                              </SelectItem>
                              <SelectItem
                                value="other"
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

                    <FormField
                      control={form.control}
                      name="competitors"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            Competitors <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <FileText className="absolute left-4 top-4 w-5 h-5 text-slate-400 dark:text-slate-500" />
                              <Textarea
                                placeholder="List your main competitors and how you differentiate..."
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
                      name="eligibilityReason"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            Eligibility Reason{" "}
                            <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormDescription className="text-sm text-slate-500 dark:text-slate-400">
                            For example, is it a live Avalanche L1 itself, does
                            it provide the needed infrastructure for
                            permissionless node sales for future L1s, does it
                            perform cross-chain swaps via ICM for Avalanche L1s,
                            etc. Please provide proof such as links to an
                            explorer, contract, or GitHub repo
                          </FormDescription>
                          <FormControl>
                            <div className="relative">
                              <FileText className="absolute left-4 top-4 w-5 h-5 text-slate-400 dark:text-slate-500" />
                              <Textarea
                                placeholder="Explain why your project qualifies for this grant..."
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

                {/* Token Information */}
                <div className="p-8 md:p-12 border-b border-slate-100 dark:border-slate-700">
                  <div className="space-y-2 mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/50 rounded-lg flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          Token Information
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Tell us about your token (if applicable)
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <FormField
                      control={form.control}
                      name="hasToken"
                      render={({ field }) => (
                        <FormItem className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/50 p-6">
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            Does your team have a token?
                          </FormLabel>
                          <div className="flex items-start space-x-4 mt-4">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="has-token-yes"
                                checked={field.value === true}
                                onCheckedChange={() =>
                                  form.setValue("hasToken", true)
                                }
                                className="border-slate-300 dark:border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                              />
                              <label
                                htmlFor="has-token-yes"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700 dark:text-slate-300 cursor-pointer"
                              >
                                Yes
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="has-token-no"
                                checked={field.value === false}
                                onCheckedChange={() =>
                                  form.setValue("hasToken", false)
                                }
                                className="border-slate-300 dark:border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                              />
                              <label
                                htmlFor="has-token-no"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700 dark:text-slate-300 cursor-pointer"
                              >
                                No
                              </label>
                            </div>
                          </div>
                          <FormMessage className="text-red-500 dark:text-red-400" />
                        </FormItem>
                      )}
                    />

                    {form.watch("hasToken") && (
                      <FormField
                        control={form.control}
                        name="tokenOnAvalanche"
                        render={({ field }) => (
                          <FormItem className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/50 p-6">
                            <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                              Is your token live on Avalanche?
                            </FormLabel>
                            <div className="flex items-start space-x-4 mt-4">
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="token-avalanche-yes"
                                  checked={field.value === true}
                                  onCheckedChange={() =>
                                    form.setValue("tokenOnAvalanche", true)
                                  }
                                  className="border-slate-300 dark:border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                />
                                <label
                                  htmlFor="token-avalanche-yes"
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700 dark:text-slate-300 cursor-pointer"
                                >
                                  Yes
                                </label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="token-avalanche-no"
                                  checked={field.value === false}
                                  onCheckedChange={() =>
                                    form.setValue("tokenOnAvalanche", false)
                                  }
                                  className="border-slate-300 dark:border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                />
                                <label
                                  htmlFor="token-avalanche-no"
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700 dark:text-slate-300 cursor-pointer"
                                >
                                  No
                                </label>
                              </div>
                            </div>
                            <FormMessage className="text-red-500 dark:text-red-400" />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </div>

                {/* Grant Information */}
                <div className="p-8 md:p-12 border-b border-slate-100 dark:border-slate-700">
                  <div className="space-y-2 mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          Grant Information
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Tell us about your funding needs
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <FormField
                      control={form.control}
                      name="grantSize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            Grant Size & Budget Breakdown{" "}
                            <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <DollarSign className="absolute left-4 top-4 w-5 h-5 text-slate-400 dark:text-slate-500" />
                              <Textarea
                                placeholder="Provide details about your requested grant size and budget allocation..."
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
                      name="userOnboarding"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            User Onboarding Estimate{" "}
                            <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Users className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                              <Input
                                className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                placeholder="Estimate the number of users/builders"
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
                      name="networkKPIs"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            Network KPIs <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormDescription className="text-sm text-slate-500 dark:text-slate-400">
                            For example, amount of TVL, volume, number of txns,
                            etc.
                          </FormDescription>
                          <FormControl>
                            <div className="relative">
                              <TrendingUp className="absolute left-4 top-4 w-5 h-5 text-slate-400 dark:text-slate-500" />
                              <Textarea
                                placeholder="Describe the KPIs your project will contribute to the Avalanche network..."
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

                {/* Previous Funding */}
                <div className="p-8 md:p-12 border-b border-slate-100 dark:border-slate-700">
                  <div className="space-y-2 mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/50 rounded-lg flex items-center justify-center">
                        <DollarSign className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          Previous Funding
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Tell us about any previous funding
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <FormField
                      control={form.control}
                      name="previousFunding"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            Previous Avalanche Funding{" "}
                            <span className="text-red-500">*</span>
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200">
                                <SelectValue placeholder="Have you received prior funding from Ava Labs or the Avalanche Foundation?" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl shadow-xl">
                              <SelectItem
                                value="yes"
                                className="text-slate-700 dark:text-slate-300 py-3"
                              >
                                Yes
                              </SelectItem>
                              <SelectItem
                                value="no"
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

                    {form.watch("previousFunding") === "yes" && (
                      <FormField
                        control={form.control}
                        name="fundingAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                              Funding Amount
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <DollarSign className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                                <Input
                                  className="pl-12 h-14 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                  placeholder="Enter amount in USD"
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
                      name="additionalValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            Additional Value
                          </FormLabel>
                          <FormDescription className="text-sm text-slate-500 dark:text-slate-400">
                            If your project has previously received a grant from
                            Avalanche, what additional value or features will a
                            Retro9000 grant cover? Expand on your roadmap and
                            why the Retro9000 grant is important to fulfill it.
                          </FormDescription>
                          <FormControl>
                            <div className="relative">
                              <FileText className="absolute left-4 top-4 w-5 h-5 text-slate-400 dark:text-slate-500" />
                              <Textarea
                                placeholder="Describe the additional value this grant will provide..."
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

                {/* Team Information */}
                <div className="p-8 md:p-12 border-b border-slate-100 dark:border-slate-700">
                  <div className="space-y-2 mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center">
                        <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          Team Information
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Tell us about your team
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <FormField
                      control={form.control}
                      name="teamBackground"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            Team Background{" "}
                            <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Users className="absolute left-4 top-4 w-5 h-5 text-slate-400 dark:text-slate-500" />
                              <Textarea
                                placeholder="Describe your team's experience and background..."
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
                      name="willingToKYB"
                      render={({ field }) => (
                        <FormItem className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/50 p-6">
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium text-base">
                            KYB Willingness
                          </FormLabel>
                          <FormDescription className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                            Is your team willing to KYB? If not, you will not be
                            eligible to receive Retro9000 funding.
                          </FormDescription>
                          <div className="flex items-start space-x-4">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="kyb-yes"
                                checked={field.value === true}
                                onCheckedChange={() =>
                                  form.setValue("willingToKYB", true)
                                }
                                className="border-slate-300 dark:border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                              />
                              <label
                                htmlFor="kyb-yes"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700 dark:text-slate-300 cursor-pointer"
                              >
                                Yes
                              </label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id="kyb-no"
                                checked={field.value === false}
                                onCheckedChange={() =>
                                  form.setValue("willingToKYB", false)
                                }
                                className="border-slate-300 dark:border-slate-600 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                              />
                              <label
                                htmlFor="kyb-no"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700 dark:text-slate-300 cursor-pointer"
                              >
                                No
                              </label>
                            </div>
                          </div>
                          <FormMessage className="text-red-500 dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Consent & Privacy */}
                <div className="p-8 md:p-12">
                  <div className="space-y-2 mb-8">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Shield className="w-4 h-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          Consent & Privacy
                        </h2>
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                          The Avalanche Foundation needs the contact information
                          you provide to us to contact you about our products
                          and services. You may unsubscribe from these
                          communications at any time. For information on how to
                          unsubscribe, as well as our privacy practices and
                          commitment to protecting your privacy, please review
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
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <FormField
                      control={form.control}
                      name="privacyPolicyRead"
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
                              I have read the Privacy Policy linked above{" "}
                              <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormDescription className="text-sm text-slate-500 dark:text-slate-400">
                              By checking this box, you confirm that you have
                              read and agree to our privacy policy.
                            </FormDescription>
                          </div>
                          <FormMessage className="text-red-500 dark:text-red-400" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="marketingConsent"
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
                              Check this box if you wish to receive additional
                              marketing communications from us.
                            </FormDescription>
                          </div>
                          <FormMessage className="text-red-500 dark:text-red-400" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="pt-8 flex justify-center">
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
                          <ArrowRight className="h-4 w-4" />
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
    </div>
  );
}
