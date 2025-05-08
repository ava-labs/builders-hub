"use client"
import Image from 'next/image'
import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"

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
  projectDescription: z.string().min(10, "Please provide a more detailed description"),
  projectType: z.string().min(1, "Project type is required"),
  competitors: z.string().min(1, "Please list your competitors"),
  eligibilityReason: z.string().min(10, "Please explain why your project is eligible"),

  // Token Information
  hasToken: z.boolean().optional(),
  tokenOnAvalanche: z.boolean().optional(),

  // Grant Information
  grantSize: z.string().min(10, "Please provide details about your requested grant size"),
  userOnboarding: z.string().min(1, "Please provide an estimate of users/builders"),
  networkKPIs: z.string().min(10, "Please describe the KPIs your project will bring"),

  // Previous Funding
  previousFunding: z.string().min(1, "Please select an option"),
  fundingAmount: z.string().optional(),
  additionalValue: z.string().optional(),

  // Team Information
  teamBackground: z.string().min(10, "Please provide background about your team"),
  willingToKYB: z.boolean().optional(),
  
  // Required consent fields
  privacyPolicyRead: z.boolean().refine(val => val === true, {
    message: "You must agree to the privacy policy to submit the form",
  }),
  marketingConsent: z.boolean().optional(),
})

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
  marketingConsent: "marketing_consent"
};

export default function GrantsForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionStatus, setSubmissionStatus] = useState<'success' | 'error' | null>(null)

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
  })

async function onSubmit(values: z.infer<typeof formSchema>) {
  setIsSubmitting(true);
  
  try {
    const hubspotFormData: Record<string, string | number | boolean> = {};

    Object.entries(values).forEach(([key, value]) => {
      const hubspotFieldName = HUBSPOT_FIELD_MAPPING[key as keyof typeof HUBSPOT_FIELD_MAPPING] || key;
      if (value === "" && key !== "firstName" && key !== "email" && !key.includes("required")) {
        return;
      }

      if (typeof value === 'boolean') {
        if (key !== 'privacyPolicyRead' && key !== 'marketingConsent') {
          hubspotFormData[hubspotFieldName] = value ? "Yes" : "No";
        } else {
          hubspotFormData[hubspotFieldName] = value;
        }
      } else {
        hubspotFormData[hubspotFieldName] = value;
      }
    });
    
    console.log("HubSpot form data after mapping:", hubspotFormData);

    const response = await fetch('/api/hubspot', {
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
    alert("Your grant application has been successfully submitted.");
    form.reset();
  } catch (error) {
    setSubmissionStatus('error');
    alert(`Error submitting application: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    setIsSubmitting(false);
  }
}

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <section className="text-center space-y-6 pt-12 pb-16">
          <div className="flex justify-center mb-6">
            <Image
              src="/logo-black.png"
              alt="Avalanche Logo"
              width={200}
              height={50}
              className="dark:hidden"
            />
            <Image
              src="/logo-white.png"
              alt="Avalanche Logo"
              width={200}
              height={50}
              className="hidden dark:block"
            />
          </div>
          <h1 className="text-4xl md:text-7xl font-bold tracking-tighter">
            Retro9000
            <span className="block pb-1 text-[#EB4C50]">
              Grants Program
            </span>
          </h1>
        </section>
      {submissionStatus === 'success' ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <h2 className="text-2xl font-semibold text-green-800 mb-4">Application Submitted Successfully!</h2>
          <p className="text-green-700 mb-6">Thank you for applying to the Retro9000 grant program. We will review your application and get back to you soon.</p>
          <Button 
            onClick={() => {
              setSubmissionStatus(null)
              form.reset()
            }}
            className="bg-green-600 hover:bg-green-700"
          >
            Submit Another Application
          </Button>
        </div>
      ) : (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Applicant Information */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 mb-8">
          <div className="space-y-1 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Applicant Information</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Tell us about yourself</p>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="dark:text-gray-200">
                      Applicant First Name <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <div className="relative flex items-center">
                        <svg
                          className="absolute left-3 w-5 h-5 text-gray-400 dark:text-gray-500"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                          />
                        </svg>
                        <Input
                          className="pl-10 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                          placeholder="First name"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="dark:text-red-400" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="dark:text-gray-200">Applicant Last Name</FormLabel>
                    <FormControl>
                      <div className="relative flex items-center">
                        <svg
                          className="absolute left-3 w-5 h-5 text-gray-400 dark:text-gray-500"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                          />
                        </svg>
                        <Input
                          className="pl-10 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                          placeholder="Last name"
                          {...field}
                        />
                      </div>
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
                  <FormLabel className="dark:text-gray-200">
                    Applicant Email <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <div className="relative flex items-center">
                      <svg
                        className="absolute left-3 w-5 h-5 text-gray-400 dark:text-gray-500"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                        />
                      </svg>
                      <Input
                        className="pl-10 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                        placeholder="email@example.com"
                        {...field}
                      />
                    </div>
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
                  <FormLabel className="dark:text-gray-200">
                    Applicant Telegram <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <div className="relative flex items-center">
                      <svg
                        className="absolute left-3 w-5 h-5 text-gray-400 dark:text-gray-500"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
                        />
                      </svg>
                      <Input
                        className="pl-10 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                        placeholder="@username"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="dark:text-red-400" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="xProfile"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="dark:text-gray-200">
                    Applicant X Profile <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <div className="relative flex items-center">
                      <svg
                        className="absolute left-3 w-5 h-5 text-gray-400 dark:text-gray-500"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
                        />
                      </svg>
                      <Input
                        className="pl-10 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                        placeholder="@username"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="dark:text-red-400" />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Project Information */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 mb-8">
          <div className="space-y-1 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Project Information</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Tell us about your project</p>
          </div>

          <div className="space-y-6">
            <FormField
              control={form.control}
              name="projectName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="dark:text-gray-200">
                    State the name of your project <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <div className="relative flex items-center">
                      <svg
                        className="absolute left-3 w-5 h-5 text-gray-400 dark:text-gray-500"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                        />
                      </svg>
                      <Input
                        className="pl-10 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                        placeholder="Project name"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="dark:text-red-400" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="projectWebsite"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="dark:text-gray-200">
                    Project/Company Website <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <div className="relative flex items-center">
                      <svg
                        className="absolute left-3 w-5 h-5 text-gray-400 dark:text-gray-500"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
                        />
                      </svg>
                      <Input
                        className="pl-10 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                        placeholder="https://your-website.com"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="dark:text-red-400" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="projectXHandle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="dark:text-gray-200">
                    Project/Company X Handle <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <div className="relative flex items-center">
                      <svg
                        className="absolute left-3 w-5 h-5 text-gray-400 dark:text-gray-500"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
                        />
                      </svg>
                      <Input
                        className="pl-10 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                        placeholder="@projecthandle"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="dark:text-red-400" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="projectGitHub"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="dark:text-gray-200">
                    Project/Company GitHub <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <div className="relative flex items-center">
                      <svg
                        className="absolute left-3 w-5 h-5 text-gray-400 dark:text-gray-500"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
                        />
                      </svg>
                      <Input
                        className="pl-10 border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                        placeholder="https://github.com/your-project"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="dark:text-red-400" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="projectDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="dark:text-gray-200">
                    Provide a brief description of your project <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe your project, its goals, and expected impact"
                      className="min-h-[120px] border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="dark:text-red-400" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="projectType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="dark:text-gray-200">
                    What is your project type? <span className="text-red-500">*</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
                        <SelectValue placeholder="Select project type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                      <SelectItem value="validator-marketplaces" className="dark:text-gray-200">
                        Validator Marketplaces
                      </SelectItem>
                      <SelectItem value="virtual-machines" className="dark:text-gray-200">
                        Virtual Machines
                      </SelectItem>
                      <SelectItem value="wallets" className="dark:text-gray-200">
                        Wallets
                      </SelectItem>
                      <SelectItem value="oracles" className="dark:text-gray-200">
                        Oracles
                      </SelectItem>
                      <SelectItem value="interoperability-tools" className="dark:text-gray-200">
                        Interoperability Tools
                      </SelectItem>
                      <SelectItem value="cryptography" className="dark:text-gray-200">
                        Cryptography
                      </SelectItem>
                      <SelectItem value="bridges" className="dark:text-gray-200">
                        Bridges
                      </SelectItem>
                      <SelectItem value="explorers" className="dark:text-gray-200">
                        Explorers
                      </SelectItem>
                      <SelectItem value="rpcs" className="dark:text-gray-200">
                        RPCs
                      </SelectItem>
                      <SelectItem value="data-storage" className="dark:text-gray-200">
                        Data Storage
                      </SelectItem>
                      <SelectItem value="indexers" className="dark:text-gray-200">
                        Indexers
                      </SelectItem>
                      <SelectItem value="token-engineering" className="dark:text-gray-200">
                        Token Engineering
                      </SelectItem>
                      <SelectItem value="on-and-offramps" className="dark:text-gray-200">
                        On & Offramps
                      </SelectItem>
                      <SelectItem value="defi" className="dark:text-gray-200">
                        DeFi
                      </SelectItem>
                      <SelectItem value="gaming" className="dark:text-gray-200">
                        Gaming
                      </SelectItem>
                      <SelectItem value="rwas-institutional" className="dark:text-gray-200">
                        RWAs/Institutional
                      </SelectItem>
                      <SelectItem value="culture-nfts" className="dark:text-gray-200">
                        Culture/NFTs
                      </SelectItem>
                      <SelectItem value="enterprise" className="dark:text-gray-200">
                        Enterprise
                      </SelectItem>
                      <SelectItem value="exchanges-wallets" className="dark:text-gray-200">
                        Exchanges/Wallets
                      </SelectItem>
                      <SelectItem value="payments" className="dark:text-gray-200">
                        Payments
                      </SelectItem>
                      <SelectItem value="ai" className="dark:text-gray-200">
                        AI
                      </SelectItem>
                      <SelectItem value="other" className="dark:text-gray-200">
                        Other
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage className="dark:text-red-400" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="competitors"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="dark:text-gray-200">
                    Who are your competitors within the industry? <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="List your main competitors and how you differentiate"
                      className="min-h-[120px] border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="dark:text-red-400" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="eligibilityReason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="dark:text-gray-200">
                    Why do you think your project is eligible for a Retro9000 grant?{" "}
                    <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormDescription className="text-xs text-gray-500 dark:text-gray-400">
                    For example, is it a live Avalanche L1 itself, does it provide the needed infrastructure for
                    permissionless node sales for future L1s, does it perform cross-chain swaps via ICM for Avalanche
                    L1s, etc. Please provide proof such as links to an explorer, contract, or GitHub repo
                  </FormDescription>
                  <FormControl>
                    <Textarea
                      placeholder="Explain why your project qualifies for this grant"
                      className="min-h-[120px] border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="dark:text-red-400" />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Token Information */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 mb-8">
          <div className="space-y-1 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Token Information</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Tell us about your token (if applicable)</p>
          </div>

          <div className="space-y-6">
            <FormField
              control={form.control}
              name="hasToken"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="dark:text-gray-200">
                    Does your team have a token? <span className="text-red-500">*</span>
                  </FormLabel>
                  <div className="flex items-start space-x-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="has-token-yes"
                        checked={field.value === true}
                        onCheckedChange={() => form.setValue("hasToken", true)}
                        className="border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                      />
                      <label
                        htmlFor="has-token-yes"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                      >
                        Yes
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="has-token-no"
                        checked={field.value === false}
                        onCheckedChange={() => form.setValue("hasToken", false)}
                        className="border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                      />
                      <label
                        htmlFor="has-token-no"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                      >
                        No
                      </label>
                    </div>
                  </div>
                  <FormMessage className="dark:text-red-400" />
                </FormItem>
              )}
            />

            {form.watch("hasToken") && (
              <FormField
                control={form.control}
                name="tokenOnAvalanche"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel className="dark:text-gray-200">If so, is your token live on Avalanche?</FormLabel>
                    <div className="flex items-start space-x-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="token-avalanche-yes"
                          checked={field.value === true}
                          onCheckedChange={() => form.setValue("tokenOnAvalanche", true)}
                          className="border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                        />
                        <label
                          htmlFor="token-avalanche-yes"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                        >
                          Yes
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="token-avalanche-no"
                          checked={field.value === false}
                          onCheckedChange={() => form.setValue("tokenOnAvalanche", false)}
                          className="border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                        />
                        <label
                          htmlFor="token-avalanche-no"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                        >
                          No
                        </label>
                      </div>
                    </div>
                    <FormMessage className="dark:text-red-400" />
                  </FormItem>
                )}
              />
            )}
          </div>
        </div>

        {/* Grant Information */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 mb-8">
          <div className="space-y-1 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Grant Information</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Tell us about your funding needs</p>
          </div>

          <div className="space-y-6">
            <FormField
              control={form.control}
              name="grantSize"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="dark:text-gray-200">
                    What is your ideal grant size and breakdown the budget for what it will be used for?{" "}
                    <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide details about your requested grant size and budget allocation"
                      className="min-h-[120px] border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="dark:text-red-400" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="userOnboarding"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="dark:text-gray-200">
                    How many new users and/or builders can your project onboard? <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Estimate the number of users/builders"
                      className="border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="dark:text-red-400" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="networkKPIs"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="dark:text-gray-200">
                    What Avalanche network KPIs will your project bring going forward?{" "}
                    <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormDescription className="text-xs text-gray-500 dark:text-gray-400">
                    For example, amount of TVL, volume, number of txns, etc.
                  </FormDescription>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the KPIs your project will contribute to the Avalanche network"
                      className="min-h-[120px] border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="dark:text-red-400" />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Previous Funding */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 mb-8">
          <div className="space-y-1 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Previous Funding</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Tell us about any previous funding</p>
          </div>

          <div className="space-y-6">
            <FormField
              control={form.control}
              name="previousFunding"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="dark:text-gray-200">
                    Have you received prior funding from Ava Labs or the Avalanche Foundation?{" "}
                    <span className="text-red-500">*</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100">
                        <SelectValue placeholder="Select an option" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
                      <SelectItem value="yes" className="dark:text-gray-200">
                        Yes
                      </SelectItem>
                      <SelectItem value="no" className="dark:text-gray-200">
                        No
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage className="dark:text-red-400" />
                </FormItem>
              )}
            />

            {form.watch("previousFunding") === "yes" && (
              <FormField
                control={form.control}
                name="fundingAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="dark:text-gray-200">If so, how much?</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter amount in USD"
                        className="border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
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
              name="additionalValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="dark:text-gray-200">
                    If your project has previously received a grant from Avalanche, what additional value or features
                    will a Retro9000 grant cover?
                  </FormLabel>
                  <FormDescription className="text-xs text-gray-500 dark:text-gray-400">
                    Expand on your roadmap and why the Retro9000 grant is important to fulfill it.
                  </FormDescription>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the additional value this grant will provide"
                      className="min-h-[120px] border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="dark:text-red-400" />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Team Information */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 mb-8">
          <div className="space-y-1 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Team Information</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Tell us about your team</p>
          </div>

          <div className="space-y-6">
            <FormField
              control={form.control}
              name="teamBackground"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="dark:text-gray-200">
                    Please provide background about your team? <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe your team's experience and background"
                      className="min-h-[120px] border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="dark:text-red-400" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="willingToKYB"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="dark:text-gray-200">Is your team willing to KYB?</FormLabel>
                  <FormDescription className="text-xs text-gray-500 dark:text-gray-400">
                    If not, you will not be eligible to receive Retro9000 funding.
                  </FormDescription>
                  <div className="flex items-start space-x-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="kyb-yes"
                        checked={field.value === true}
                        onCheckedChange={() => form.setValue("willingToKYB", true)}
                        className="border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                      />
                      <label
                        htmlFor="kyb-yes"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                      >
                        Yes
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="kyb-no"
                        checked={field.value === false}
                        onCheckedChange={() => form.setValue("willingToKYB", false)}
                        className="border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                      />
                      <label
                        htmlFor="kyb-no"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                      >
                        No
                      </label>
                    </div>
                  </div>
                  <FormMessage className="dark:text-red-400" />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Record Consent */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 mb-8">
          <div className="space-y-1 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Consent</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              The Avalanche Foundation needs the contact information you provide to us to contact you about our products and services.
              You may unsubscribe from these communications at any time. For information on how to unsubscribe, 
              as well as our privacy practices and commitment to protecting your privacy, please review our <a className="underline" href="https://www.avax.network/privacy-policy">Privacy Policy</a>.
              </p>
          </div>

          <div className="space-y-6">
            <FormField
              control={form.control}
              name="privacyPolicyRead"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-gray-200 dark:border-gray-700 p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="font-normal dark:text-gray-200">
                      I have read the privacy policy <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormDescription className="text-xs text-gray-500 dark:text-gray-400">
                      By checking this box, you confirm that you have read and agree to our privacy policy.
                    </FormDescription>
                  </div>
                  <FormMessage className="dark:text-red-400" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="marketingConsent"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-gray-200 dark:border-gray-700 p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="font-normal dark:text-gray-200">
                      I would like to receive marketing emails from the Avalanche Foundation
                    </FormLabel>
                    <FormDescription className="text-xs text-gray-500 dark:text-gray-400">
                      Check this box if you wish to receive marketing communications from us.
                    </FormDescription>
                  </div>
                  <FormMessage className="dark:text-red-400" />
                </FormItem>
              )}
            />
          </div>
        </div>
        <div className="pt-4">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-2 bg-primary hover:bg-primary/90 dark:bg-primary dark:hover:bg-primary/90"
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
  )
}
