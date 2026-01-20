"use client";

import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import { useState, useEffect, useRef } from "react";
import { useSession, getSession } from "next-auth/react";
import { useLoginModalTrigger, useLoginCompleteListener } from "@/hooks/useLoginModal";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Loader2, User, Building2, MapPin, Briefcase, Trophy, MessageCircle, AlertCircle, CheckCircle2, ChevronRight, ChevronLeft, BadgeCheck } from "lucide-react";
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
import { getReferrer } from "@/lib/referral";

const EMPLOYMENT_ROLES = ["Accounting", "Administrative", "Development", "Communications", "Consulting", "Customer", "Design", "Education", "Engineering", "Entrepreneurship", "Finance", "Health", "Human Resources", "Information Technology", "Legal", "Marketing", "Operations", "Product", "Project Management", "Public Relations", "Quality Assurance", "Real Estate", "Recruiting", "Research", "Sales", "Support", "Retired", "Other"];

const EMPLOYMENT_STATUS = ["Full time", "Part time", "Self-employed", "Unemployed", "Student"];

const AREA_OF_FOCUS = [
  { value: "consumer", label: "Consumer" },
  { value: "defi", label: "DeFi" },
  { value: "enterprise", label: "Enterprise" },
  { value: "developer_tool", label: "Developer Tool" },
  { value: "rwa", label: "RWA" },
  { value: "gaming", label: "Gaming" },
];

const HOW_DID_YOU_HEAR = ["Referred by a friend", "Twitter/X", "Ava Labs staff member", "Discord", "Telegram", "AVAX partner or investor", "Team1", "Avalanche Marketing", "Other"];

const STEPS = [
  { id: 1, name: "Personal Info", description: "Your contact details", icon: User },
  { id: 2, name: "Location", description: "Where are you based", icon: MapPin },
  { id: 3, name: "Before We Move Forward", description: "Mandatory vibe check", icon: Briefcase },
  { id: 4, name: "Project Details", description: "What you're building", icon: Building2 },
  { id: 5, name: "Why You?", description: "Make your case", icon: Trophy },
  { id: 6, name: "Additional Info", description: "A few more questions", icon: MessageCircle },
  { id: 7, name: "Consent & Privacy", description: "Final step", icon: AlertCircle },
];

const formSchema = z.object({
  hackathonName: z.string().default("Build Games 2026"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email"),
  telegram: z.string().optional(),
  github: z.string().optional(),

  country: z.string().min(1, "Country is required"),

  readyToWin: z.enum(["yes", "no"], { message: "Please select an option" }),
  previousAvalancheGrant: z.enum(["yes", "no"], { message: "Please select an option" }),
  hackathonExperience: z.enum(["yes", "no"]).optional(),
  hackathonDetails: z.string().optional(),
  employmentRole: z.string().optional(),
  currentRole: z.string().optional(),
  employmentStatus: z.string().optional(),

  projectName: z.string().min(1, "Project name is required"),
  projectDescription: z.string().min(1, "Project description is required"),
  areaOfFocus: z.string().min(1, "Area of focus is required"),

  whyYou: z.string().min(1, "This field is required"),

  howDidYouHear: z.string().min(1, "Please select an option"),
  howDidYouHearSpecify: z.string().min(1, "Please specify how you heard about us"),
  referrerName: z.string().optional(),
  universityAffiliation: z.enum(["yes", "no"], { message: "Please select an option" }),
  avalancheEcosystemMember: z.enum(["yes", "no"], { message: "Please select an option" }),

  privacyPolicyRead: z.boolean().refine((val) => val === true, {
    message: "You must agree to the privacy policy to submit the form",
  }),
  marketingConsent: z.boolean().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function BuildGamesApplyForm() {
  const { data: session, status, update } = useSession();
  const { openLoginModal } = useLoginModalTrigger();
  const hasTriggeredModalRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<"success" | "error" | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [isSessionVerified, setIsSessionVerified] = useState(false);

  // Listen for login complete event and refresh session
  useLoginCompleteListener(async () => {
    // Force refresh the session when login completes
    await update();
    setIsSessionVerified(true);
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      hackathonName: "Build Games 2026",
      firstName: "",
      lastName: "",
      email: "",
      telegram: "",
      github: "",
      country: "",
      readyToWin: undefined,
      previousAvalancheGrant: undefined,
      hackathonExperience: undefined,
      hackathonDetails: "",
      employmentRole: "",
      currentRole: "",
      employmentStatus: "",
      projectName: "",
      projectDescription: "",
      areaOfFocus: "",
      whyYou: "",
      howDidYouHear: "",
      howDidYouHearSpecify: "",
      referrerName: "",
      universityAffiliation: undefined,
      avalancheEcosystemMember: undefined,
      privacyPolicyRead: false,
      marketingConsent: false,
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
  // Uses getSession() to double-check auth state and handle stale useSession data
  useEffect(() => {
    if (status === "loading") return;
    if (status === "authenticated" && session?.user) {
      setIsSessionVerified(true);
      return;
    }
    // If we've already verified the session via login complete event, skip
    if (isSessionVerified) return;
    if (hasTriggeredModalRef.current) return;

    // Double-check with fresh session to handle race conditions
    const checkAndTriggerModal = async () => {
      const freshSession = await getSession();
      if (freshSession?.user) {
        // User is actually authenticated, useSession just hasn't updated yet
        setIsSessionVerified(true);
        return;
      }
      // User is truly unauthenticated, show login modal
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
    watchedValues.firstName &&
    watchedValues.lastName &&
    watchedValues.email &&
    watchedValues.country &&
    watchedValues.readyToWin &&
    watchedValues.previousAvalancheGrant &&
    watchedValues.projectName &&
    watchedValues.projectDescription &&
    watchedValues.areaOfFocus &&
    watchedValues.whyYou &&
    watchedValues.howDidYouHear &&
    watchedValues.howDidYouHearSpecify &&
    watchedValues.universityAffiliation &&
    watchedValues.avalancheEcosystemMember &&
    watchedValues.privacyPolicyRead
  );

  // Show loading skeleton while session is loading or user is unauthenticated
  // But if we've verified the session via getSession() or login complete event, show form
  if (status === "loading" || (status === "unauthenticated" && !isSessionVerified)) {
    return (
      <div className="min-h-screen bg-black">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
            {/* Sidebar Skeleton */}
            <aside className="hidden lg:block">
              <div className="sticky top-8">
                <div className="mb-4 flex items-center gap-3 pb-4 border-b border-border">
                  <div className="w-10 h-10 rounded bg-zinc-800 animate-pulse" />
                  <div className="h-5 w-36 rounded bg-zinc-800 animate-pulse" />
                </div>
                <nav className="space-y-2">
                  {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <div key={i} className="flex items-center gap-4 rounded-lg p-[6px]">
                      <div className="h-10 w-10 shrink-0 rounded bg-zinc-800 animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-24 rounded bg-zinc-800 animate-pulse" />
                        <div className="h-3 w-32 rounded bg-zinc-800/60 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </nav>
              </div>
            </aside>

            {/* Form Skeleton */}
            <main>
              <div className="rounded-xl border border-zinc-800 bg-[#030303] p-6 sm:p-8">
                {/* Header Skeleton */}
                <div className="mb-8">
                  <div className="h-8 w-48 rounded bg-zinc-800 animate-pulse" />
                  <div className="mt-2 h-4 w-64 rounded bg-zinc-800/60 animate-pulse" />
                </div>

                {/* Form Fields Skeleton */}
                <div className="space-y-6">
                  <div className="space-y-2">
                    <div className="h-4 w-28 rounded bg-zinc-800 animate-pulse" />
                    <div className="h-12 w-full rounded bg-zinc-800/50 animate-pulse" />
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <div className="h-4 w-24 rounded bg-zinc-800 animate-pulse" />
                      <div className="h-12 w-full rounded bg-zinc-800/50 animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-24 rounded bg-zinc-800 animate-pulse" />
                      <div className="h-12 w-full rounded bg-zinc-800/50 animate-pulse" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="h-4 w-20 rounded bg-zinc-800 animate-pulse" />
                    <div className="h-12 w-full rounded bg-zinc-800/50 animate-pulse" />
                  </div>

                  <div className="space-y-2">
                    <div className="h-4 w-32 rounded bg-zinc-800 animate-pulse" />
                    <div className="h-3 w-48 rounded bg-zinc-800/40 animate-pulse" />
                    <div className="h-12 w-full rounded bg-zinc-800/50 animate-pulse" />
                  </div>

                  <div className="space-y-2">
                    <div className="h-4 w-44 rounded bg-zinc-800 animate-pulse" />
                    <div className="h-3 w-72 rounded bg-zinc-800/40 animate-pulse" />
                    <div className="h-12 w-full rounded bg-zinc-800/50 animate-pulse" />
                  </div>
                </div>

                {/* Navigation Skeleton */}
                <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
                  <div className="h-10 w-28 rounded bg-zinc-800/50 animate-pulse" />
                  <div className="h-10 w-28 rounded bg-zinc-800 animate-pulse" />
                </div>
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  async function onSubmit(values: FormData) {
    setIsSubmitting(true);
    try {
      const referrer = getReferrer();

      const response = await fetch("/api/build-games/apply", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          ...values,
          referrer: referrer,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to submit application");
      }

      setSubmissionStatus("success");
      form.reset();
    } catch (error) {
      setSubmissionStatus("error");
      alert(`Error submitting form: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submissionStatus === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-4">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-accent">
            <CheckCircle2 className="h-10 w-10 text-accent-foreground" />
          </div>
          <h1 className="mb-4 text-3xl font-bold text-foreground">Application Submitted!</h1>
          <p className="mx-auto max-w-md text-muted-foreground">
            Thank you for applying to Build Games 2026. We'll review your application and get back to you soon.
          </p>
          <Button
            className="mt-8"
            onClick={() => {
              setSubmissionStatus(null);
              setCurrentStep(1);
              form.reset();
            }}
          >
            Submit Another Application
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          {/* Sidebar - Step Progress */}
          <aside className="hidden lg:block">
            <div className="sticky top-8">
              <div className="mb-4 flex items-center gap-3 pb-4 border-b border-border">
                <AvalancheLogo className="w-10 h-10" />
                <span className="text-lg font-semibold uppercase tracking-wide text-muted-foreground">Build Games 2026</span>
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
                        currentStep === step.id
                          ? "bg-secondary text-foreground"
                          : step.id < currentStep
                            ? "text-muted-foreground hover:bg-secondary/50"
                            : "text-muted-foreground/60"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded border text-sm font-medium",
                          currentStep === step.id
                            ? "border-foreground bg-foreground text-background"
                            : step.id < currentStep
                              ? "border-[#EB4C50] bg-[#EB4C50] text-white"
                              : "border-border"
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

          {/* Main Content */}
          <main>
            {/* Mobile Step Indicator */}
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
                <div
                  className="h-1 rounded-full bg-[#EB4C50] transition-all"
                  style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
                />
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                {/* Form Card */}
                <div className="rounded-xl border border-zinc-800 bg-[#030303] p-6 sm:p-8">
                  <div className="mb-8">
                    <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
                      {STEPS[currentStep - 1].name}
                    </h1>
                    <p className="mt-2 text-muted-foreground">
                      {STEPS[currentStep - 1].description}
                    </p>
                  </div>

                  {/* Step 1: Personal Info */}
                  {currentStep === 1 && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-foreground">
                          Competition Name
                        </Label>
                        <Input
                          className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground cursor-not-allowed"
                          value="Build Games 2026"
                          disabled
                        />
                      </div>

                      <div className="grid gap-6 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="firstName"
                          render={({ field }) => (
                            <FormItem className="space-y-2">
                              <Label className="text-sm font-medium text-foreground">
                                First Name <span className="text-destructive">*</span>
                              </Label>
                              <FormControl>
                                <Input
                                  className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground placeholder:text-muted-foreground"
                                  placeholder="First name"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage className="text-destructive" />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="lastName"
                          render={({ field }) => (
                            <FormItem className="space-y-2">
                              <Label className="text-sm font-medium text-foreground">
                                Last Name <span className="text-destructive">*</span>
                              </Label>
                              <FormControl>
                                <Input
                                  className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground placeholder:text-muted-foreground"
                                  placeholder="Last name"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage className="text-destructive" />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Email <span className="text-destructive">*</span>
                            </Label>
                            <FormControl>
                              <Input
                                className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground cursor-not-allowed"
                                type="email"
                                disabled
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="telegram"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Telegram Handle
                            </Label>
                            <FormDescription className="text-xs text-muted-foreground">
                              Share your Telegram handle.
                            </FormDescription>
                            <FormControl>
                              <Input
                                className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground placeholder:text-muted-foreground"
                                placeholder="@username"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="github"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Your personal or company GitHub
                            </Label>
                            <FormDescription className="text-xs text-muted-foreground">
                              Share the link to your personal or company's GitHub account.
                            </FormDescription>
                            <FormControl>
                              <Input
                                className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground placeholder:text-muted-foreground"
                                placeholder="https://github.com/username"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* Step 2: Location */}
                  {currentStep === 2 && (
                    <div className="space-y-6">
                      <FormField
                        control={form.control}
                        name="country"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Country <span className="text-destructive">*</span>
                            </Label>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground">
                                  <SelectValue placeholder="Select your country" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="max-h-[300px]">
                                {countries.map((country) => (
                                  <SelectItem key={country.value} value={country.value}>
                                    {country.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* Step 3: Before We Move Forward */}
                  {currentStep === 3 && (
                    <div className="space-y-6">
                      <div className="rounded-lg border border-border bg-secondary/50 p-4 text-xs text-muted-foreground space-y-3">
                        <p>
                          Our goal is to find and support the next cohort of <strong className="text-foreground">Avalanche founders</strong>.
                          This is not a bounty event. The prize pool is meaningful, but the real upside is for builders who want to
                          <strong className="text-foreground"> stick around and build their vision on Avalanche</strong>.
                          If you are selected as a winner, a portion of your rewards will be tied to:
                        </p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>Continuing to build on Avalanche</li>
                          <li>Hitting clear milestones in your roadmap</li>
                          <li>Showing real progress through on-chain or product KPIs</li>
                        </ul>
                        <p>
                          We are not asking for a legal lock in, but we are very intentional about where we put this capital and support.
                          If your plan is to ship something quick, collect a prize, and move on to another chain, this program is probably not the right fit.
                          If you want to become a 10x founder on Avalanche and are willing to commit to that path, we would love to see your application.
                          <strong className="text-foreground"> So, are you ready to win?</strong>
                        </p>
                        <p className="text-xs text-muted-foreground/60 italic">
                          Choosing "No" automatically disqualifies you from participating in Build Games.
                        </p>
                      </div>

                      <FormField
                        control={form.control}
                        name="readyToWin"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Are you ready to win? <span className="text-destructive">*</span>
                            </Label>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                value={field.value}
                                className="flex flex-col space-y-2"
                              >
                                <div className="flex items-center space-x-3">
                                  <RadioGroupItem value="yes" id="ready-yes" />
                                  <Label htmlFor="ready-yes" className="cursor-pointer text-foreground">Yes</Label>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <RadioGroupItem value="no" id="ready-no" />
                                  <Label htmlFor="ready-no" className="cursor-pointer text-foreground">No</Label>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="previousAvalancheGrant"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Have you received a grant previously from Avalanche? <span className="text-destructive">*</span>
                            </Label>
                            <FormDescription className="text-xs text-muted-foreground">
                              Prior support from the Avalanche Foundation — including funding via Retro9000, Infra(BOOST), Infra(BUILD/LINK), Blizzard, Codebase, Innovation House, or Ava Labs — will be considered during the evaluation process and may impact grant size.
                            </FormDescription>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                value={field.value}
                                className="flex flex-col space-y-2"
                              >
                                <div className="flex items-center space-x-3">
                                  <RadioGroupItem value="yes" id="grant-yes" />
                                  <Label htmlFor="grant-yes" className="cursor-pointer text-foreground">Yes</Label>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <RadioGroupItem value="no" id="grant-no" />
                                  <Label htmlFor="grant-no" className="cursor-pointer text-foreground">No</Label>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="hackathonExperience"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Have you participated in any hackathons in the past?
                            </Label>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                value={field.value}
                                className="flex flex-col space-y-2"
                              >
                                <div className="flex items-center space-x-3">
                                  <RadioGroupItem value="yes" id="hackathon-yes" />
                                  <Label htmlFor="hackathon-yes" className="cursor-pointer text-foreground">Yes</Label>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <RadioGroupItem value="no" id="hackathon-no" />
                                  <Label htmlFor="hackathon-no" className="cursor-pointer text-foreground">No</Label>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      {watchedValues.hackathonExperience === "yes" && (
                        <FormField
                          control={form.control}
                          name="hackathonDetails"
                          render={({ field }) => (
                            <FormItem className="space-y-2">
                              <Label className="text-sm font-medium text-foreground">
                                How many, and have you won?
                              </Label>
                              <FormControl>
                                <Textarea
                                  className="min-h-[100px] resize-none border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground placeholder:text-muted-foreground"
                                  placeholder="Tell us about your hackathon experience..."
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage className="text-destructive" />
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={form.control}
                        name="employmentRole"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Employment Role
                            </Label>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground">
                                  <SelectValue placeholder="Select your role" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="max-h-[300px]">
                                {EMPLOYMENT_ROLES.map((role) => (
                                  <SelectItem key={role} value={role.toLowerCase().replace(/\s+/g, '_')}>
                                    {role}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="currentRole"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              What is your current role?
                            </Label>
                            <FormControl>
                              <Input
                                className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground placeholder:text-muted-foreground"
                                placeholder="e.g., Software Engineer at Company"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="employmentStatus"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              What is your current employment status?
                            </Label>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground">
                                  <SelectValue placeholder="Select your status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {EMPLOYMENT_STATUS.map((status) => (
                                  <SelectItem key={status} value={status.toLowerCase().replace(/\s+/g, '_')}>
                                    {status}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* Step 4: Project Details */}
                  {currentStep === 4 && (
                    <div className="space-y-6">
                      <FormField
                        control={form.control}
                        name="projectName"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Name of your company or project <span className="text-destructive">*</span>
                            </Label>
                            <FormControl>
                              <Input
                                className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground placeholder:text-muted-foreground"
                                placeholder="Your project name"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="projectDescription"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Your company or project's one-line description <span className="text-destructive">*</span>
                            </Label>
                            <FormControl>
                              <Input
                                className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground placeholder:text-muted-foreground"
                                placeholder="A brief description of what you're building"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="areaOfFocus"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Area of Focus <span className="text-destructive">*</span>
                            </Label>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground">
                                  <SelectValue placeholder="Select area of focus" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {AREA_OF_FOCUS.map((area) => (
                                  <SelectItem key={area.value} value={area.value}>
                                    {area.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <div className="rounded-lg border border-border bg-secondary/50 p-4 text-xs text-muted-foreground">
                        <p className="font-semibold text-foreground mb-2">Note on Definitions</p>
                        <ul className="space-y-1">
                          <li><strong className="text-foreground">Consumer:</strong> anything B2C non-financial related.</li>
                          <li><strong className="text-foreground">DeFi:</strong> anything finance, stablecoin, or FinTech related.</li>
                          <li><strong className="text-foreground">Enterprise:</strong> Anything that would be sold to and used by another business (B2B)</li>
                          <li><strong className="text-foreground">Developer Tool:</strong> anything that would be purchased and used by a developer/tech organization.</li>
                          <li><strong className="text-foreground">RWA:</strong> anything that is a real-world asset this is being tokenized (eg. think commodities).</li>
                          <li><strong className="text-foreground">Gaming:</strong> anything that pertains to a game of chance or skill.</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Step 5: Why You */}
                  {currentStep === 5 && (
                    <div className="space-y-6">
                      <FormField
                        control={form.control}
                        name="whyYou"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Do you believe you and your team could be Avalanche's next top founder(s)? Why? <span className="text-destructive">*</span>
                            </Label>
                            <FormDescription className="text-xs text-muted-foreground">
                              Describe the qualities that you and your team possess and why you believe you will win Build Games.
                            </FormDescription>
                            <FormControl>
                              <Textarea
                                className="min-h-[150px] resize-none border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground placeholder:text-muted-foreground"
                                placeholder="Tell us why you should be chosen..."
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* Step 6: Additional Info */}
                  {currentStep === 6 && (
                    <div className="space-y-6">
                      <FormField
                        control={form.control}
                        name="howDidYouHear"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              How did you hear about Build Games? <span className="text-destructive">*</span>
                            </Label>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground">
                                  <SelectValue placeholder="Select an option" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {HOW_DID_YOU_HEAR.map((option) => (
                                  <SelectItem key={option} value={option.toLowerCase().replace(/[\s/]+/g, '_')}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="howDidYouHearSpecify"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Please specify <span className="text-destructive">*</span>
                            </Label>
                            <FormControl>
                              <Input
                                className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground placeholder:text-muted-foreground"
                                placeholder="Please specify"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="referrerName"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Please list their name:
                            </Label>
                            <FormControl>
                              <Input
                                className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground placeholder:text-muted-foreground"
                                placeholder="Referrer's name"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="universityAffiliation"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Are you affiliated with a university? <span className="text-destructive">*</span>
                            </Label>
                            <FormDescription className="text-xs text-muted-foreground">
                              Choose "Yes" if you are a current student, faculty, professional, or administrator.
                            </FormDescription>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger className="h-12 border-border bg-[color-mix(in_oklab,var(--input)_50%,transparent)] text-foreground">
                                  <SelectValue placeholder="Select an option" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="yes">Yes</SelectItem>
                                <SelectItem value="no">No</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="avalancheEcosystemMember"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <Label className="text-sm font-medium text-foreground">
                              Would you consider yourself an existing member of the Avalanche ecosystem, however you may define that? <span className="text-destructive">*</span>
                            </Label>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                value={field.value}
                                className="flex flex-col space-y-2"
                              >
                                <div className="flex items-center space-x-3">
                                  <RadioGroupItem value="yes" id="ecosystem-yes" />
                                  <Label htmlFor="ecosystem-yes" className="cursor-pointer text-foreground">Yes</Label>
                                </div>
                                <div className="flex items-center space-x-3">
                                  <RadioGroupItem value="no" id="ecosystem-no" />
                                  <Label htmlFor="ecosystem-no" className="cursor-pointer text-foreground">No</Label>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage className="text-destructive" />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* Step 7: Consent & Privacy */}
                  {currentStep === 7 && (
                    <div className="space-y-6">
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

                      <FormField
                        control={form.control}
                        name="privacyPolicyRead"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-4 space-y-0 rounded-lg border border-border bg-secondary/50 p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none flex-1">
                              <Label className="font-medium text-foreground cursor-pointer">
                                I have read and agree to the privacy policy linked above. <span className="text-destructive">*</span>
                              </Label>
                            </div>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="marketingConsent"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-4 space-y-0 rounded-lg border border-border bg-secondary/50 p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none flex-1">
                              <Label className="font-medium text-foreground cursor-pointer">
                                I want to receive emails regarding valuable resources, funding opportunities, events, and notifications,
                                including information on upcoming Build Games seasons from the Avalanche Foundation.
                              </Label>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  {/* Navigation */}
                  <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handlePrev}
                      disabled={currentStep === 1}
                      className="gap-2 bg-transparent"
                    >
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
