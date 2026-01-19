"use client";

import Image from "next/image";
import { useState, useCallback, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Loader2, Mail, User, Building2, MapPin, Briefcase, Trophy, MessageCircle, Check, AlertCircle, ArrowRight, Github, Send, Lock, Gamepad2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { countries } from "@/constants/countries";
import { cn } from "@/lib/utils";

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

const formSchema = z.object({
  hackathonName: z.string().default("Build Games 2026"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email"),
  telegram: z.string().optional(),
  github: z.string().min(1, "GitHub link is required"),

  country: z.string().min(1, "Country is required"),

  readyToWin: z.enum(["yes", "no"], { message: "Please select an option" }),
  hackathonExperience: z.enum(["yes", "no"], { message: "Please select an option" }),
  hackathonDetails: z.string().optional(),
  employmentRole: z.string().optional(),
  currentRole: z.string().optional(),
  employmentStatus: z.string().optional(),

  projectName: z.string().min(1, "Project name is required"),
  projectDescription: z.string().min(1, "Project description is required"),
  areaOfFocus: z.string().min(1, "Area of focus is required"),

  whyYou: z.string().min(1, "This field is required"),

  howDidYouHear: z.string().min(1, "Please select an option"),
  howDidYouHearSpecify: z.string().optional(),
  referrerName: z.string().optional(),
  universityAffiliation: z.enum(["yes", "no"], { message: "Please select an option" }),
  avalancheEcosystemMember: z.enum(["yes", "no"], { message: "Please select an option" }),

  privacyPolicyRead: z.boolean().refine((val) => val === true, {
    message: "You must agree to the privacy policy to submit the form",
  }),
  marketingConsent: z.boolean().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AccordionSectionProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  iconBg: string;
  children: React.ReactNode;
  isLocked: boolean;
  isComplete: boolean;
  sectionNumber: number;
  isOpen: boolean;
  onToggle: () => void;
}

function AccordionSection({title, description, icon, iconBg, children, isLocked, isComplete, sectionNumber, isOpen, onToggle}: AccordionSectionProps) {
  return (
    <div className={cn("border-b border-slate-200 dark:border-slate-700 transition-all duration-300", isLocked && "opacity-60")}>
      <button
        type="button"
        onClick={() => !isLocked && onToggle()}
        disabled={isLocked}
        className={cn(
          "w-full p-4 md:p-6 flex items-center gap-4 text-left transition-all duration-200",
          !isLocked && "hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer",
          isLocked && "cursor-not-allowed",
          isOpen && "bg-slate-50/50 dark:bg-slate-700/30"
        )}
      >
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300", isComplete ? "bg-emerald-500" : iconBg)}>
          {isComplete ? (
            <Check className="w-5 h-5 text-white" />
          ) : isLocked ? (
            <Lock className="w-4 h-4 text-slate-400" />
          ) : (
            icon
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
              STEP {sectionNumber}
            </span>
            {isComplete && (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                Complete
              </span>
            )}
            {isLocked && (
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Locked
              </span>
            )}
          </div>
          <h2 className="text-base md:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
            {title}
          </h2>
          {description && !isOpen && (
            <p className="text-sm text-slate-500 dark:text-slate-400 truncate hidden md:block">
              {description}
            </p>
          )}
        </div>

        <ChevronDown className={cn("w-5 h-5 text-slate-400 transition-transform duration-300 flex-shrink-0", isOpen && "rotate-180")} />
      </button>

      <div className={cn("overflow-hidden transition-all duration-300 ease-in-out", isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0")}>
        <div className="p-4 md:p-6 pt-0 md:pt-0 space-y-6">
          {description && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {description}
            </p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

export default function BuildGamesApplyForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<"success" | "error" | null>(null);
  const [openSection, setOpenSection] = useState(1);

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

  const checkSection1Complete = useCallback(() => {
    const { firstName, lastName, email, github } = watchedValues;
    return !!(firstName && lastName && email && github);
  }, [watchedValues]);

  const checkSection2Complete = useCallback(() => {
    return !!watchedValues.country;
  }, [watchedValues]);

  const checkSection3Complete = useCallback(() => {
    const { readyToWin, hackathonExperience } = watchedValues;
    return readyToWin === "yes" && hackathonExperience !== undefined;
  }, [watchedValues]);

  const checkSection4Complete = useCallback(() => {
    const { projectName, projectDescription, areaOfFocus } = watchedValues;
    return !!(projectName && projectDescription && areaOfFocus);
  }, [watchedValues]);

  const checkSection5Complete = useCallback(() => {
    return !!watchedValues.whyYou;
  }, [watchedValues]);

  const checkSection6Complete = useCallback(() => {
    const { howDidYouHear, universityAffiliation, avalancheEcosystemMember } = watchedValues;
    return !!(howDidYouHear && universityAffiliation && avalancheEcosystemMember);
  }, [watchedValues]);

  const section1Complete = checkSection1Complete();
  const section2Complete = checkSection2Complete();
  const section3Complete = checkSection3Complete();
  const section4Complete = checkSection4Complete();
  const section5Complete = checkSection5Complete();
  const section6Complete = checkSection6Complete();

  useEffect(() => {
    if (section1Complete && openSection === 1) setOpenSection(2);
    else if (section2Complete && openSection === 2) setOpenSection(3);
    else if (section3Complete && openSection === 3) setOpenSection(4);
    else if (section4Complete && openSection === 4) setOpenSection(5);
    else if (section5Complete && openSection === 5) setOpenSection(6);
    else if (section6Complete && openSection === 6) setOpenSection(7);
  }, [section1Complete, section2Complete, section3Complete, section4Complete, section5Complete, section6Complete, openSection]);

  const handleSectionToggle = (sectionNumber: number) => {
    setOpenSection(openSection === sectionNumber ? 0 : sectionNumber);
  };

  async function onSubmit(values: FormData) {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/build-games/apply", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to submit application");
      }

      setSubmissionStatus("success");
      form.reset();
    } catch (error) {
      setSubmissionStatus("error");
      alert(`Error submitting form: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <section className="text-center space-y-6 pt-8 pb-10">
          <div className="flex justify-center mb-6">
            <Image src="/logo-black.png" alt="Avalanche Logo" width={200} height={50} className="dark:hidden" />
            <Image src="/logo-white.png" alt="Avalanche Logo" width={200} height={50} className="hidden dark:block" />
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 dark:from-white dark:via-slate-200 dark:to-white bg-clip-text text-transparent">
                Build Games
              </span>
              <span className="block text-[#EB4C50] flex items-center justify-center gap-3 mt-2">
                2026
                <Gamepad2 className="w-8 h-8 md:w-10 md:h-10 text-[#EB4C50]" />
              </span>
            </h1>

            <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
              Apply to participate in Build Games 2026. Complete all sections below to submit your application.
            </p>
          </div>
        </section>

        {submissionStatus === "success" ? (
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-12 text-center shadow-lg">
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-3xl font-bold text-emerald-800 dark:text-emerald-200 mb-4">
              Application Submitted!
            </h2>
            <p className="text-emerald-700 dark:text-emerald-300 mb-8 text-lg">
              Thank you for applying to Build Games 2026. We'll review your application and get back to you soon.
            </p>
            <Button
              onClick={() => {
                setSubmissionStatus(null);
                form.reset();
                setOpenSection(1);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 text-lg font-medium rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
            >
              Submit Another Application
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        ) : (
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/50 dark:border-slate-700/50 overflow-hidden">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-0">
                <AccordionSection
                  title="Let's start with the building blocks"
                  description="Tell us about yourself"
                  icon={<User className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
                  iconBg="bg-blue-100 dark:bg-blue-900/50"
                  isLocked={false}
                  isComplete={section1Complete}
                  sectionNumber={1}
                  isOpen={openSection === 1}
                  onToggle={() => handleSectionToggle(1)}
                >
                  <FormField
                    control={form.control}
                    name="hackathonName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-500 dark:text-slate-400 font-medium text-sm">
                          Hackathon Name
                        </FormLabel>
                        <FormControl>
                          <Input
                            className="h-12 text-base border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 rounded-xl cursor-not-allowed"
                            {...field}
                            disabled
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium">
                            First Name <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                              <Input
                                className="pl-10 h-12 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="First name"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-500" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium">
                            Applicant Last Name <span className="text-red-500">*</span>
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                              <Input
                                className="pl-10 h-12 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Last name"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage className="text-red-500" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium">
                          Email <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <Input
                              className="pl-10 h-12 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="johndoe@gmail.com"
                              type="email"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="telegram"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium">
                          Telegram Handle
                        </FormLabel>
                        <FormDescription className="text-slate-500 text-sm">
                          Share your Telegram handle.
                        </FormDescription>
                        <FormControl>
                          <div className="relative">
                            <Send className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <Input
                              className="pl-10 h-12 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="@username"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="github"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium">
                          Your personal or company GitHub <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormDescription className="text-slate-500 text-sm">
                          Share the link to your personal or company's GitHub account.
                        </FormDescription>
                        <FormControl>
                          <div className="relative">
                            <Github className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <Input
                              className="pl-10 h-12 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="https://github.com/username"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500" />
                      </FormItem>
                    )}
                  />
                </AccordionSection>

                <AccordionSection
                  title="Thanks! Where are you located?"
                  icon={<MapPin className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
                  iconBg="bg-purple-100 dark:bg-purple-900/50"
                  isLocked={!section1Complete}
                  isComplete={section2Complete}
                  sectionNumber={2}
                  isOpen={openSection === 2}
                  onToggle={() => handleSectionToggle(2)}
                >
                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium">
                          Country <span className="text-red-500">*</span>
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                              <SelectValue placeholder="Select your country" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[300px] bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl">
                            {countries.map((country) => (
                              <SelectItem
                                key={country.value}
                                value={country.value}
                                className="text-slate-700 dark:text-slate-300 py-2"
                              >
                                {country.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-red-500" />
                      </FormItem>
                    )}
                  />
                </AccordionSection>

                <AccordionSection
                  title="Before we move forward..."
                  description="We want to be clear about what 'winning' Build Games means."
                  icon={<Briefcase className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
                  iconBg="bg-amber-100 dark:bg-amber-900/50"
                  isLocked={!section2Complete}
                  isComplete={section3Complete}
                  sectionNumber={3}
                  isOpen={openSection === 3}
                  onToggle={() => handleSectionToggle(3)}
                >
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 text-sm text-slate-600 dark:text-slate-300 space-y-3">
                    <p>
                      Our goal is to find and support the next cohort of <strong className="text-slate-800 dark:text-white">Avalanche founders</strong>.
                      This is not a bounty event. The prize pool is meaningful, but the real upside is for builders who want to
                      <strong className="text-slate-800 dark:text-white"> stick around and build their vision on Avalanche</strong>.
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
                      <strong className="text-slate-800 dark:text-white"> So, are you ready to win?</strong>
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                      Choosing "No" automatically disqualifies you from participating in Build Games.
                    </p>
                  </div>

                  <FormField
                    control={form.control}
                    name="readyToWin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium">
                          Are you ready to win? <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex flex-col space-y-2"
                          >
                            <div className="flex items-center space-x-3">
                              <RadioGroupItem value="yes" id="ready-yes" />
                              <Label htmlFor="ready-yes" className="cursor-pointer">Yes</Label>
                            </div>
                            <div className="flex items-center space-x-3">
                              <RadioGroupItem value="no" id="ready-no" />
                              <Label htmlFor="ready-no" className="cursor-pointer">No</Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage className="text-red-500" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="hackathonExperience"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium">
                          Have you participated in any hackathons in the past? <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex flex-col space-y-2"
                          >
                            <div className="flex items-center space-x-3">
                              <RadioGroupItem value="yes" id="hackathon-yes" />
                              <Label htmlFor="hackathon-yes" className="cursor-pointer">Yes</Label>
                            </div>
                            <div className="flex items-center space-x-3">
                              <RadioGroupItem value="no" id="hackathon-no" />
                              <Label htmlFor="hackathon-no" className="cursor-pointer">No</Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage className="text-red-500" />
                      </FormItem>
                    )}
                  />

                  {watchedValues.hackathonExperience === "yes" && (
                    <FormField
                      control={form.control}
                      name="hackathonDetails"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-slate-700 dark:text-slate-300 font-medium">
                            How many, and have you won?
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              className="min-h-[100px] text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                              placeholder="Tell us about your hackathon experience..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage className="text-red-500" />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="employmentRole"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium">
                          Employment Role
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent">
                              <SelectValue placeholder="Select your role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-[300px] bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl">
                            {EMPLOYMENT_ROLES.map((role) => (
                              <SelectItem
                                key={role}
                                value={role.toLowerCase().replace(/\s+/g, '_')}
                                className="text-slate-700 dark:text-slate-300 py-2"
                              >
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-red-500" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="currentRole"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium">
                          What is your current role?
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Briefcase className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <Input
                              className="pl-10 h-12 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                              placeholder="e.g., Software Engineer at Company"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="employmentStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium">
                          What is your current employment status?
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent">
                              <SelectValue placeholder="Select your status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl">
                            {EMPLOYMENT_STATUS.map((status) => (
                              <SelectItem
                                key={status}
                                value={status.toLowerCase().replace(/\s+/g, '_')}
                                className="text-slate-700 dark:text-slate-300 py-2"
                              >
                                {status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-red-500" />
                      </FormItem>
                    )}
                  />
                </AccordionSection>

                <AccordionSection
                  title="Great! Tell us more about what you'll be building."
                  icon={<Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
                  iconBg="bg-indigo-100 dark:bg-indigo-900/50"
                  isLocked={!section3Complete}
                  isComplete={section4Complete}
                  sectionNumber={4}
                  isOpen={openSection === 4}
                  onToggle={() => handleSectionToggle(4)}
                >
                  <FormField
                    control={form.control}
                    name="projectName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium">
                          Name of your company or project <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <Input
                              className="pl-10 h-12 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                              placeholder="Your project name"
                              {...field}
                            />
                          </div>
                        </FormControl>
                        <FormMessage className="text-red-500" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="projectDescription"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium">
                          Your company or project's one-line description <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            className="h-12 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder="A brief description of what you're building"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-red-500" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="areaOfFocus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium">
                          Area of Focus <span className="text-red-500">*</span>
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                              <SelectValue placeholder="Select area of focus" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl">
                            {AREA_OF_FOCUS.map((area) => (
                              <SelectItem
                                key={area.value}
                                value={area.value}
                                className="text-slate-700 dark:text-slate-300 py-2"
                              >
                                {area.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-red-500" />
                      </FormItem>
                    )}
                  />

                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 text-sm text-slate-600 dark:text-slate-300">
                    <p className="font-semibold text-slate-800 dark:text-white mb-2">Note on Definitions</p>
                    <ul className="space-y-1">
                      <li><strong>Consumer:</strong> anything B2C non-financial related.</li>
                      <li><strong>DeFi:</strong> anything finance, stablecoin, or FinTech related.</li>
                      <li><strong>Enterprise:</strong> Anything that would be sold to and used by another business (B2B)</li>
                      <li><strong>Developer Tool:</strong> anything that would be purchased and used by a developer/tech organization.</li>
                      <li><strong>RWA:</strong> anything that is a real-world asset this is being tokenized (eg. think commodities).</li>
                      <li><strong>Gaming:</strong> anything that pertains to a game of chance or skill.</li>
                    </ul>
                  </div>
                </AccordionSection>

                <AccordionSection
                  title="Why should you be chosen?"
                  icon={<Trophy className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />}
                  iconBg="bg-yellow-100 dark:bg-yellow-900/50"
                  isLocked={!section4Complete}
                  isComplete={section5Complete}
                  sectionNumber={5}
                  isOpen={openSection === 5}
                  onToggle={() => handleSectionToggle(5)}
                >
                  <FormField
                    control={form.control}
                    name="whyYou"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium">
                          Do you believe you and your team could be Avalanche's next top founder(s)? Why? <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormDescription className="text-slate-500 text-sm">
                          Describe the qualities that you and your team possess and why you believe you will win Build Games.
                        </FormDescription>
                        <FormControl>
                          <Textarea
                            className="min-h-[150px] text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none"
                            placeholder="Tell us why you should be chosen..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage className="text-red-500" />
                      </FormItem>
                    )}
                  />
                </AccordionSection>

                <AccordionSection
                  title="Last thing!"
                  icon={<MessageCircle className="w-5 h-5 text-pink-600 dark:text-pink-400" />}
                  iconBg="bg-pink-100 dark:bg-pink-900/50"
                  isLocked={!section5Complete}
                  isComplete={section6Complete}
                  sectionNumber={6}
                  isOpen={openSection === 6}
                  onToggle={() => handleSectionToggle(6)}
                >
                  <FormField
                    control={form.control}
                    name="howDidYouHear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium">
                          How did you hear about Build Games? <span className="text-red-500">*</span>
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent">
                              <SelectValue placeholder="Select an option" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl">
                            {HOW_DID_YOU_HEAR.map((option) => (
                              <SelectItem
                                key={option}
                                value={option.toLowerCase().replace(/[\s/]+/g, '_')}
                                className="text-slate-700 dark:text-slate-300 py-2"
                              >
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-red-500" />
                      </FormItem>
                    )}
                  />

                  {(watchedValues.howDidYouHear === "other" || watchedValues.howDidYouHear === "referred_by_a_friend" || watchedValues.howDidYouHear === "ava_labs_staff_member" || watchedValues.howDidYouHear === "avax_partner_or_investor") && (
                    <>
                      <FormField
                        control={form.control}
                        name="howDidYouHearSpecify"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 dark:text-slate-300 font-medium">
                              Please specify <span className="text-red-500">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                className="h-12 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                placeholder="Please specify"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-red-500" />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="referrerName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-slate-700 dark:text-slate-300 font-medium">
                              Please list their name:
                            </FormLabel>
                            <FormControl>
                              <Input
                                className="h-12 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                                placeholder="Referrer's name"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage className="text-red-500" />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  <FormField
                    control={form.control}
                    name="universityAffiliation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium">
                          Are you affiliated with a university? <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormDescription className="text-slate-500 text-sm">
                          Choose "Yes" if you are a current student, faculty, professional, or administrator.
                        </FormDescription>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 text-base border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-700/50 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent">
                              <SelectValue placeholder="Select an option" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl">
                            <SelectItem value="yes" className="text-slate-700 dark:text-slate-300 py-2">Yes</SelectItem>
                            <SelectItem value="no" className="text-slate-700 dark:text-slate-300 py-2">No</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-red-500" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="avalancheEcosystemMember"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-700 dark:text-slate-300 font-medium">
                          Would you consider yourself an existing member of the Avalanche ecosystem, however you may define that? <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex flex-col space-y-2"
                          >
                            <div className="flex items-center space-x-3">
                              <RadioGroupItem value="yes" id="ecosystem-yes" />
                              <Label htmlFor="ecosystem-yes" className="cursor-pointer">Yes</Label>
                            </div>
                            <div className="flex items-center space-x-3">
                              <RadioGroupItem value="no" id="ecosystem-no" />
                              <Label htmlFor="ecosystem-no" className="cursor-pointer">No</Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage className="text-red-500" />
                      </FormItem>
                    )}
                  />
                </AccordionSection>

                <AccordionSection
                  title="Done!"
                  description="Make sure you review your answers before submitting this application."
                  icon={<AlertCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
                  iconBg="bg-emerald-100 dark:bg-emerald-900/50"
                  isLocked={!section6Complete}
                  isComplete={false}
                  sectionNumber={7}
                  isOpen={openSection === 7}
                  onToggle={() => handleSectionToggle(7)}
                >
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 text-sm text-slate-600 dark:text-slate-300">
                    <p>
                      The Avalanche Foundation needs the contact information you provide to us to contact you about our products and services.
                      You may unsubscribe from these communications at any time. For information on how to unsubscribe, as well as our privacy
                      practices and commitment to protecting your privacy, please review our{" "}
                      <a href="https://www.avax.network/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                        Privacy Policy
                      </a>.
                    </p>
                  </div>

                  <FormField
                    control={form.control}
                    name="privacyPolicyRead"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-4 space-y-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/50 p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="border-slate-300 dark:border-slate-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 mt-1"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none flex-1">
                          <FormLabel className="font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                            I have read and agree to the privacy policy linked above. <span className="text-red-500">*</span>
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="marketingConsent"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-4 space-y-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/50 p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="border-slate-300 dark:border-slate-600 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 mt-1"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none flex-1">
                          <FormLabel className="font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                            I want to receive emails regarding valuable resources, funding opportunities, events, and notifications,
                            including information on upcoming Build Games seasons from the Avalanche Foundation.
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  <div className="pt-4 flex justify-center">
                    <Button
                      type="submit"
                      disabled={isSubmitting || !section6Complete}
                      className="px-10 py-3 text-base font-semibold bg-[#FF394A] hover:bg-[#e6333f] text-white rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          Submit your application
                          <ArrowRight className="h-5 w-5 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </AccordionSection>
              </form>
            </Form>
          </div>
        )}
      </div>
    </div>
  );
}
