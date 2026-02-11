"use client";

import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import { useState, useEffect, useRef } from "react";
import { useSession, getSession } from "next-auth/react";
import { useLoginModalTrigger, useLoginCompleteListener } from "@/hooks/useLoginModal";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Loader2, Building2, DollarSign, FileText, User, CheckCircle2, ChevronRight, ChevronLeft, BadgeCheck, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { countries } from "@/constants/countries";
import { cn } from "@/lib/utils";
import { formSchema, jobRoles, projectTypes, projectVerticals, continents, fundingRanges, type Retro9000ReturningFormData } from "@/types/retro9000ReturningForm";

const STEPS = [
  { id: 1, name: "Applicant Info", description: "Your contact details", icon: User },
  { id: 2, name: "Project Overview", description: "Tell us about your project", icon: Building2 },
  { id: 3, name: "Financial Overview", description: "Funding history and request", icon: DollarSign },
  { id: 4, name: "Grant Information", description: "Eligibility and changes", icon: FileText },
  { id: 5, name: "Compliance", description: "Final agreements", icon: Shield },
];

export default function Retro9000ReturningForm() {
  const { data: session, status, update } = useSession();
  const { openLoginModal } = useLoginModalTrigger();
  const hasTriggeredModalRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<"success" | "error" | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSessionVerified, setIsSessionVerified] = useState(false);

  useLoginCompleteListener(async () => {
    await update();
    setIsSessionVerified(true);
  });

  const form = useForm<Retro9000ReturningFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      project_name: "",
      project_type: "",
      project_vertical: "",
      project_website: "",
      project_x_handle: "",
      project_github: "",
      project_hq: "",
      project_continent: "",
      media_kit: "",
      previous_retro9000_snapshot_funding: "",
      requested_funding_range: "",
      eligibility_and_metrics: "",
      requested_grant_size_budget: "",
      changes_since_last_snapshot: "",
      first_name: "",
      last_name: "",
      pseudonym: "",
      role: "",
      email: "",
      x_account: "",
      telegram: "",
      linkedin: "",
      github: "",
      country: "",
      other_url: "",
      bio: "",
      kyb_willing: "",
      gdpr: false,
      marketing_consent: false,
    },
    mode: "onChange",
  });

  const watchedValues = useWatch({ control: form.control });

  // Prefill email from session
  useEffect(() => {
    if (session?.user?.email) {
      form.setValue("email", session.user.email);
    }
  }, [session?.user?.email, form]);

  // Show login modal for unauthenticated users
  useEffect(() => {
    if (status === "loading") return;
    if (status === "authenticated" && session?.user) {
      setIsSessionVerified(true);
      return;
    }
    if (isSessionVerified) return;
    if (hasTriggeredModalRef.current) return;

    const checkAndTriggerModal = async () => {
      const freshSession = await getSession();
      if (freshSession?.user) {
        setIsSessionVerified(true);
        return;
      }
      hasTriggeredModalRef.current = true;
      openLoginModal(window.location.href);
    };

    checkAndTriggerModal();
  }, [status, session, openLoginModal, isSessionVerified]);

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Check if all required fields are filled
  const isFormComplete = Boolean(
    watchedValues.project_name &&
    watchedValues.project_type &&
    watchedValues.project_vertical &&
    watchedValues.project_github &&
    watchedValues.project_hq &&
    watchedValues.project_continent &&
    watchedValues.media_kit &&
    watchedValues.requested_funding_range &&
    watchedValues.eligibility_and_metrics &&
    watchedValues.requested_grant_size_budget &&
    watchedValues.changes_since_last_snapshot &&
    watchedValues.first_name &&
    watchedValues.last_name &&
    watchedValues.role &&
    watchedValues.email &&
    watchedValues.x_account &&
    watchedValues.telegram &&
    watchedValues.bio &&
    watchedValues.kyb_willing &&
    watchedValues.gdpr
  );

  // Loading skeleton
  if (status === "loading" || (status === "unauthenticated" && !isSessionVerified)) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
            <aside className="hidden lg:block">
              <div className="sticky top-8">
                <div className="mb-4 flex items-center gap-3 pb-4 border-b border-border">
                  <div className="w-10 h-10 rounded bg-muted animate-pulse" />
                  <div className="h-5 w-36 rounded bg-muted animate-pulse" />
                </div>
                <nav className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-4 rounded-lg p-[6px]">
                      <div className="h-10 w-10 shrink-0 rounded bg-muted animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                        <div className="h-3 w-32 rounded bg-muted/60 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </nav>
              </div>
            </aside>
            <main>
              <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
                <div className="mb-8">
                  <div className="h-8 w-48 rounded bg-muted animate-pulse" />
                  <div className="mt-2 h-4 w-64 rounded bg-muted/60 animate-pulse" />
                </div>
                <div className="space-y-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-4 w-28 rounded bg-muted animate-pulse" />
                      <div className="h-12 w-full rounded bg-muted/50 animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  async function onSubmit(values: Retro9000ReturningFormData) {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/retro9000-returning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const result = await response.json();
      if (!response.ok || !result.success) { throw new Error(result.message || "Failed to submit application") }
      setSubmissionStatus("success");
      form.reset();
      if (session?.user?.email) { form.setValue("email", session.user.email) }
    } catch (error) {
      setSubmissionStatus("error");
      alert(`Error submitting form: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submissionStatus === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-accent">
            <CheckCircle2 className="h-10 w-10 text-accent-foreground" />
          </div>
          <h1 className="mb-4 text-3xl font-bold text-foreground">Application Submitted!</h1>
          <p className="mx-auto max-w-md text-muted-foreground">Thank you for applying to the Retro9000 Returning program. We&apos;ll review your application and get back to you soon.</p>
          <Button
            className="mt-8"
            onClick={() => {
              setSubmissionStatus(null);
              setCurrentStep(1);
              form.reset();
              if (session?.user?.email) { form.setValue("email", session.user.email) }
            }}
          >
            Submit Another Application
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          {/* Sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-8">
              <div className="mb-4 flex items-center gap-3 pb-4 border-b border-border">
                <AvalancheLogo className="w-10 h-10" />
                <span className="text-lg font-semibold uppercase tracking-wide text-muted-foreground">Retro9000 Returning</span>
              </div>
              <nav className="space-y-2">
                {STEPS.map((step) => {
                  const Icon = step.icon;
                  return (
                    <button
                      key={step.id}
                      onClick={() => setCurrentStep(step.id)}
                      className={cn(
                        "flex w-full items-center gap-4 rounded-lg !p-[6px] text-left transition-all",
                        currentStep === step.id ? "bg-secondary text-foreground" : step.id < currentStep ? "text-muted-foreground hover:bg-secondary/50" : "text-muted-foreground/60"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded border text-sm font-medium",
                          currentStep === step.id ? "border-foreground bg-foreground text-background" : step.id < currentStep ? "border-[#EB4C50] bg-[#EB4C50] text-white" : "border-border"
                        )}
                      >
                        {step.id < currentStep ? (
                          <BadgeCheck className="h-5 w-5" />
                        ) : (
                          <Icon className="h-5 w-5" />
                        )}
                      </span>
                      <div>
                        <p className="text-base font-medium">{step.name}</p>
                        <p className="text-sm text-muted-foreground">{step.description}</p>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          <main>
            <div className="mb-6 lg:hidden">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">
                  Step {currentStep} of {STEPS.length}
                </span>
                <span className="text-muted-foreground">
                  {STEPS[currentStep - 1].name}
                </span>
              </div>
              <div className="mt-2 h-1 w-full rounded-full bg-secondary">
                <div className="h-1 rounded-full bg-[#EB4C50] transition-all" style={{ width: `${(currentStep / STEPS.length) * 100}%` }} />
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
                  <div className="mb-8">
                    <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                      {STEPS[currentStep - 1].name}
                    </h1>
                    <p className="mt-2 text-muted-foreground">
                      {STEPS[currentStep - 1].description}
                    </p>
                  </div>

                  {currentStep === 2 && (
                    <div className="space-y-6">
                      <FormField
                        control={form.control}
                        name="project_name"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Project/Company Name <span className="text-destructive">*</span>
                            </Label>
                            <FormControl>
                              <Input className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground placeholder:text-muted-foreground" placeholder="Your project name" {...field} />
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField control={form.control} name="project_type"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Project Type <span className="text-destructive">*</span>
                            </Label>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground">
                                  <SelectValue placeholder="Select project type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="max-h-[300px]">
                                {projectTypes.map((type) => (
                                  <SelectItem key={type} value={type}>{type}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField control={form.control} name="project_vertical"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Project Vertical <span className="text-destructive">*</span>
                            </Label>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground">
                                  <SelectValue placeholder="Select project vertical" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="max-h-[300px]">
                                {projectVerticals.map((vertical) => (
                                  <SelectItem key={vertical} value={vertical}>{vertical}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField control={form.control} name="project_website"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Project/Company Website
                            </Label>
                            <FormControl>
                              <Input className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground placeholder:text-muted-foreground" placeholder="https://yourproject.com" {...field} />
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField control={form.control} name="project_x_handle"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Project/Company X Handle
                            </Label>
                            <FormControl>
                              <Input className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground placeholder:text-muted-foreground" placeholder="https://x.com/yourproject" {...field} />
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField control={form.control} name="project_github"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Project/Company GitHub <span className="text-destructive">*</span>
                            </Label>
                            <FormControl>
                              <Input className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground placeholder:text-muted-foreground" placeholder="https://github.com/yourproject" {...field} />
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField control={form.control} name="project_hq"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Project/Company HQ <span className="text-destructive">*</span>
                            </Label>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground">
                                  <SelectValue placeholder="Select country" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="max-h-[300px]">
                                {countries.map((country) => (
                                  <SelectItem key={country.value} value={country.value}>{country.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField control={form.control} name="project_continent"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Project/Company Continent <span className="text-destructive">*</span>
                            </Label>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground">
                                  <SelectValue placeholder="Select continent" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {continents.map((continent) => (
                                  <SelectItem key={continent} value={continent}>{continent}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField control={form.control} name="media_kit"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Media Kit <span className="text-destructive">*</span>
                            </Label>
                            <FormDescription className="text-xs text-muted-foreground">
                              Please share a Google Drive folder link for your brand guidelines, logos, and video/static assets that can be used in social content. Ensure the folder is accessible to anyone with the link.
                            </FormDescription>
                            <FormControl>
                              <Input className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground placeholder:text-muted-foreground" placeholder="https://drive.google.com/..." {...field} />
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {currentStep === 3 && (
                    <div className="space-y-6">
                      <FormField control={form.control} name="previous_retro9000_snapshot_funding"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Previous Retro9000 Snapshot and Funding
                            </Label>
                            <FormDescription className="text-xs text-muted-foreground">
                              Please list snapshot(s) and amount(s)
                            </FormDescription>
                            <FormControl>
                              <Input className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground placeholder:text-muted-foreground" placeholder="e.g., Snapshot 3: $50,000" {...field} />
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField control={form.control} name="requested_funding_range"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Requested Funding Range <span className="text-destructive">*</span>
                            </Label>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground">
                                  <SelectValue placeholder="Select funding range" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {fundingRanges.map((range) => (
                                  <SelectItem key={range} value={range}>{range}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {currentStep === 4 && (
                    <div className="space-y-6">
                      <FormField control={form.control} name="eligibility_and_metrics"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Why do you think your project is eligible for a Retro9000 grant for this snapshot? <span className="text-destructive">*</span>
                            </Label>
                            <FormDescription className="text-xs text-muted-foreground">
                              E.g., is it a live Avalanche L1 itself, does it provide the needed infrastructure for permissionless node sales for future L1s, does it perform cross-chain swaps via ICM for Avalanche L1s, etc. Please provide proof (i.e., links to an explorer, contract, or GitHub repo). Please provide relevant quantitative metrics that reflect adoption or usage of the project (e.g., number of validators, transaction volume, ICM messages, TVL, DEX volumes, monthly active users, etc.).
                            </FormDescription>
                            <FormControl>
                              <Textarea className="min-h-[150px] resize-none border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground placeholder:text-muted-foreground" placeholder="Describe your eligibility and provide relevant metrics..." {...field} />
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField control={form.control} name="requested_grant_size_budget"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Requested Grant Size & Budget <span className="text-destructive">*</span>
                            </Label>
                            <FormControl>
                              <Input className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground placeholder:text-muted-foreground" placeholder="e.g., $75,000 for infrastructure and development" {...field} />
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField control={form.control} name="changes_since_last_snapshot"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              What has changed since the last Retro9000 snapshot you participated in? <span className="text-destructive">*</span>
                            </Label>
                            <FormDescription className="text-xs text-muted-foreground">
                              Please quantify changes and include supporting evidence where possible. Key Metrics to Update: ICM Messages, Number of Validators, Monthly Active Users (MAUs), Transaction Count (TXNs), Total Value Locked (TVL), DEX Trading Volume, RWA Market Capitalization (if applicable), Gas Fees Generated, Fees Burned (in AVAX).
                            </FormDescription>
                            <FormControl>
                              <Textarea className="min-h-[200px] resize-none border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground placeholder:text-muted-foreground" placeholder="Describe changes and provide updated metrics..." {...field} />
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {currentStep === 1 && (
                    <div className="space-y-6">
                      <div className="grid gap-6 sm:grid-cols-2">
                        <FormField control={form.control} name="first_name"
                          render={({ field }) => (
                            <FormItem className="space-y-2">
                              <Label className="text-sm font-medium text-foreground">
                                First Name <span className="text-destructive">*</span>
                              </Label>
                              <FormControl>
                                <Input className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground placeholder:text-muted-foreground" placeholder="First name" {...field} />
                              </FormControl>
                              <FormMessage className="text-destructive" />
                            </FormItem>
                          )}
                        />

                        <FormField control={form.control} name="last_name"
                          render={({ field }) => (
                            <FormItem className="space-y-2">
                              <Label className="text-sm font-medium text-foreground">
                                Last Name <span className="text-destructive">*</span>
                              </Label>
                              <FormControl>
                                <Input className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground placeholder:text-muted-foreground" placeholder="Last name" {...field} />
                              </FormControl>
                              <FormMessage className="text-destructive" />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField control={form.control} name="pseudonym"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Pseudonym
                            </Label>
                            <FormControl>
                              <Input className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground placeholder:text-muted-foreground" placeholder="Your pseudonym (optional)" {...field} />
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField control={form.control} name="role"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Role <span className="text-destructive">*</span>
                            </Label>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground">
                                  <SelectValue placeholder="Select your role" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="max-h-[300px]">
                                {jobRoles.map((role) => (
                                  <SelectItem key={role} value={role}>{role}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField control={form.control} name="email"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Email <span className="text-destructive">*</span>
                            </Label>
                            <FormControl>
                              <Input className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground cursor-not-allowed" type="email" disabled {...field} />
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField control={form.control} name="x_account"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              X <span className="text-destructive">*</span>
                            </Label>
                            <FormDescription className="text-xs text-muted-foreground">
                              https://x.com/username
                            </FormDescription>
                            <FormControl>
                              <Input className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground placeholder:text-muted-foreground" placeholder="https://x.com/username" {...field} />
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField control={form.control} name="telegram"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Telegram <span className="text-destructive">*</span>
                            </Label>
                            <FormDescription className="text-xs text-muted-foreground">
                              t.me/username
                            </FormDescription>
                            <FormControl>
                              <Input className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground placeholder:text-muted-foreground" placeholder="https://t.me/username" {...field} />
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField control={form.control} name="linkedin"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              LinkedIn
                            </Label>
                            <FormDescription className="text-xs text-muted-foreground">
                              linkedin.com/in/username/
                            </FormDescription>
                            <FormControl>
                              <Input className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground placeholder:text-muted-foreground" placeholder="https://linkedin.com/in/username" {...field} />
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField control={form.control} name="github"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              GitHub
                            </Label>
                            <FormDescription className="text-xs text-muted-foreground">
                              https://github.com/username
                            </FormDescription>
                            <FormControl>
                              <Input className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground placeholder:text-muted-foreground" placeholder="https://github.com/username" {...field} />
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField control={form.control} name="country"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Country
                            </Label>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground">
                                  <SelectValue placeholder="Select your country" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="max-h-[300px]">
                                {countries.map((country) => (
                                  <SelectItem key={country.value} value={country.value}>{country.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField control={form.control} name="other_url"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Other
                            </Label>
                            <FormControl>
                              <Input className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground placeholder:text-muted-foreground" placeholder="Any other URL" {...field} />
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField control={form.control} name="bio"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Bio <span className="text-destructive">*</span>
                            </Label>
                            <FormDescription className="text-xs text-muted-foreground">
                              100 words limit
                            </FormDescription>
                            <FormControl>
                              <Textarea className="min-h-[100px] resize-none border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground placeholder:text-muted-foreground" placeholder="Tell us about yourself..." {...field} />
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {currentStep === 5 && (
                    <div className="space-y-6">
                      <FormField control={form.control} name="kyb_willing"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Is your team willing to KYB? <span className="text-destructive">*</span>
                            </Label>
                            <FormDescription className="text-xs text-muted-foreground">
                              If not, you will not be eligible to receive Retro9000 funding.
                            </FormDescription>
                            <FormControl>
                              <RadioGroup onValueChange={field.onChange} value={field.value} className="flex flex-col space-y-2">
                                <div className="flex items-center space-x-3">
                                  <RadioGroupItem value="Yes" id="kyb-yes" />
                                  <Label htmlFor="kyb-yes" className="cursor-pointer text-foreground">Yes</Label>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <RadioGroupItem value="No" id="kyb-no" />
                                  <Label htmlFor="kyb-no" className="cursor-pointer text-foreground">No</Label>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <div className="rounded-lg border border-accent bg-accent/10 p-4">
                        <p className="text-sm text-foreground">
                          The Avalanche Foundation needs the contact information you provide to us to contact you about our products and services.
                          You may unsubscribe from these communications at any time. For information on how to unsubscribe, as well as our privacy
                          practices and commitment to protecting your privacy, please review our{" "}
                          <a href="https://www.avax.network/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[#66acd6] hover:text-[#7bbde3] hover:underline font-medium">
                            Privacy Policy
                          </a>.
                        </p>
                      </div>

                      <FormField control={form.control} name="gdpr"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-4 space-y-0 rounded-lg border border-border bg-secondary/50 p-4">
                            <FormControl>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <div className="space-y-1 leading-none flex-1">
                              <Label className="font-medium text-foreground cursor-pointer">
                                By checking this box, you agree and authorize the Avalanche Foundation to utilize artificial intelligence systems to process the information in your application, any related material you provide to us and any related communications between you and the Avalanche Foundation, in order to assess the eligibility and suitability of your application and proposal. You can withdraw your consent at any time. For more details on data processing and your rights, please refer to our Privacy Policy. <span className="text-destructive">*</span>
                              </Label>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField control={form.control} name="marketing_consent"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-4 space-y-0 rounded-lg border border-border bg-secondary/50 p-4">
                            <FormControl>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <div className="space-y-1 leading-none flex-1">
                              <Label className="font-medium text-foreground cursor-pointer">
                                Check this box to stay up to date with all things Avalanche, including promotional emails about events, initiatives and programs. You can unsubscribe anytime.
                              </Label>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
                    <Button type="button" variant="outline" onClick={handlePrev} disabled={currentStep === 1} className="gap-2 bg-transparent">
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    {currentStep === STEPS.length ? (
                      <Button type="submit" disabled={isSubmitting || !isFormComplete} className="gap-2">
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            Submit Application
                            <CheckCircle2 className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button type="button" onClick={handleNext} className="gap-2">
                        Continue
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </form>
            </Form>
          </main>
        </div>
      </div>
    </div>
  );
}
