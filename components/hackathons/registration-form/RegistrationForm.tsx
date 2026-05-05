"use client";

import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Separator } from "@/components/ui/separator";
import { zodResolver } from "@/lib/zodResolver";
import React, { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { RegisterFormStep3 } from "./RegisterFormStep3";
import RegisterFormStep1 from "./RegisterFormStep1";
import { useSession } from "next-auth/react";
import { User } from "next-auth";
import axios from "axios";
import { HackathonHeader } from "@/types/hackathons";
import { RegistrationForm } from "@/types/registrationForm";
import { useRouter } from "next/navigation";
import { LoadingButton } from "@/components/ui/loading-button";
import Modal from "@/components/ui/Modal";
import ProcessCompletedDialog from "./ProcessCompletedDialog";
import { useUTMPreservation } from "@/hooks/use-utm-preservation";
import { normalizeEventsLang, t } from "@/lib/events/i18n";
import { captureEventReferrerFromUrl, getEventReferrer, clearEventReferrer } from "@/lib/referral";

// Esquema de validación
const createRegisterSchema = (isOnline: boolean) => z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  company_name: z.string().optional(),
  telegram_user: z.string().min(1, "Telegram username is required"),
  role: z.string().optional(),
  city: z.string().min(1, "City is required"),
  interests: z.array(z.string()).optional(),
  web3_proficiency: z.string().optional(),
  tools: z.array(z.string()).optional(),
  roles: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  hackathon_participation: z.string().optional(),
  dietary: z.string().optional().default(""),
  github_portfolio: z.string().optional(),
  terms_event_conditions: z.boolean().optional(),
  newsletter_subscription: z.boolean().default(false).optional(),
  prohibited_items: z.boolean().optional(),
  founder_check: z.boolean().optional(),
  avalanche_ecosystem_member: z.boolean().optional(),
});

export const registerSchema = createRegisterSchema(false); // Default schema for TypeScript inference

export type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterForm({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const { data: session, status } = useSession();
  const currentUser: User | undefined = session?.user;
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({});
  let hackathon_id = (searchParams?.event ?? searchParams?.hackathon ?? "") as string;
  const utm = searchParams?.utm ?? "";
  const [hackathon, setHackathon] = useState<HackathonHeader | null>(null);
  const [formLoaded, setRegistrationForm] = useState<RegistrationForm | null>(
    null
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const router = useRouter();
  const [isSavingLater, setIsSavingLater] = useState(false);
  const isAdvancingStepRef = useRef(false);

  // Use UTM preservation hook
  const { getPreservedUTMs } = useUTMPreservation();

  // Capture referrer from URL on mount
  useEffect(() => {
    captureEventReferrerFromUrl();
  }, []);

  // Determine if hackathon is online based on location
  const isOnlineHackathon = hackathon?.location?.toLowerCase().includes("online") || false;
  const lang = normalizeEventsLang(hackathon?.content?.language);
  
  const getDefaultValues = () => ({
    
    name: currentUser?.name || "",
    email: currentUser?.email || "",
    company_name: "",
    role: "",
    city: "",
    dietary: "",
    interests: [],
    web3_proficiency: "",
    tools: [],
    roles: [],
    languages: [],
    hackathon_participation: "",
    github_portfolio: "",
    telegram_user: "",
    terms_event_conditions: false,
    newsletter_subscription: false,
    prohibited_items: false,
    founder_check: false,
    avalanche_ecosystem_member: false,
  });

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(createRegisterSchema(isOnlineHackathon)),
    defaultValues: getDefaultValues(),
  });

  function setDataFromLocalStorage() {
    if (typeof window !== "undefined") {
      const savedData = localStorage.getItem(`formData_${hackathon_id}`);

      if (savedData) {
        const { utm: utm_local, hackathon_id: hackathon_id_local } =
          JSON.parse(savedData);
        try {
          const parsedData: RegisterFormValues = JSON.parse(savedData);

          form.reset(parsedData);
          hackathon_id = hackathon_id_local || hackathon_id;
        } catch (err) {
          console.error("Error parsing localStorage data:", err);
        }
      }
    }
  }

  async function getHackathon() {
    if (!hackathon_id) return;
    try {
      const response = await axios.get(`/api/events/${hackathon_id}`);
      setHackathon(response.data);
    } catch (err) {
      console.error("API Error:", err);
    }
  }

  /** Prefill step1 from profile (name, email, country, telegram, company, role) when field is empty */
  async function mergeProfileIntoStep1() {
    const userId = (currentUser as { id?: string })?.id;
    if (!userId) return;
    try {
      const profileRes = await fetch(`/api/profile/extended/${userId}`);
      if (!profileRes.ok) return;
      const profile = await profileRes.json();
      const current = form.getValues();
      const merged = {
        ...current,
        name:  profile.name || current.name || "",
        email:  profile.email || current.email || "",
        city:  profile.country || current.city || "",
        telegram_user:  profile.telegram_user || current.telegram_user || "",
        company_name:  profile.user_type?.company_name || profile.user_type?.founder_company_name || profile.user_type?.employee_company_name || profile.user_type?.student_institution || current.company_name || "",
        role:  profile.user_type?.employee_role || profile.user_type?.role || current.role || "",
      };
      form.reset(merged);
    } catch (err) {
      console.error("Error merging profile into registration form:", err);
    }
  }

  /** Persist step1 fields to profile (name, email, country, telegram, company_name, role) */
  async function saveStep1ToProfile() {
    const userId = (currentUser as { id?: string })?.id;
    if (!userId) return;
    const step1 = form.getValues();
    try {
      const profileRes = await fetch(`/api/profile/extended/${userId}`);
      if (!profileRes.ok) return;
      const existing = await profileRes.json();
      const userType = existing.user_type || {};
      const payload = {
        name: step1.name ?? existing.name,
        email: step1.email ?? existing.email,
        country: (step1.city ?? "").trim() || existing.country,
        telegram_user: (step1.telegram_user ?? "").trim() || existing.telegram_user,
        user_type: {
          ...userType,
          company_name: (step1.company_name ?? "").trim() || userType.company_name,
          role: (step1.role ?? "").trim() || userType.role,
          employee_role: (step1.role ?? "").trim() || userType.employee_role,
        },
      };
      await fetch(`/api/profile/extended/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error("Error saving step1 to profile:", err);
    }
  }

  async function getRegisterFormLoaded() {
    if (!hackathon_id || !currentUser?.email) return;
    try {
      const response = await axios.get(
        `/api/register-form?hackathonId=${hackathon_id}&email=${currentUser.email}`
      );
      const loadedData = response.data;
      if (loadedData) {
        const parsedData = {
          name: loadedData.name || currentUser.name || "",
          email: loadedData.email || currentUser.email || "",
          company_name: loadedData.company_name || "",
          role: loadedData.role || "",
          city: loadedData.city || "",
          dietary: loadedData.dietary || "",
          telegram_user: loadedData.telegram_user || "",
          interests: loadedData.interests
            ? parseArrayField(loadedData.interests)
            : [],
          web3_proficiency: loadedData.web3_proficiency || "",
          tools: loadedData.tools ? parseArrayField(loadedData.tools) : [],
          roles: loadedData.roles ? parseArrayField(loadedData.roles) : [],
          languages: loadedData.languages
            ? parseArrayField(loadedData.languages)
            : [],
          hackathon_participation: loadedData.hackathon_participation || "",
          github_portfolio: loadedData.github_portfolio || "",
          terms_event_conditions: loadedData.terms_event_conditions || false,
          newsletter_subscription: loadedData.newsletter_subscription || false,
          prohibited_items: !isOnlineHackathon ? (loadedData.prohibited_items || false) : false,
          founder_check: loadedData.founder_check || false,
          avalanche_ecosystem_member: loadedData.avalanche_ecosystem_member || false,
        };
        hackathon_id = loadedData.hackathon_id;
        form.reset(parsedData);
        setRegistrationForm(loadedData);
      }
      setDataFromLocalStorage();
      await mergeProfileIntoStep1();
    } catch (err) {
      setDataFromLocalStorage();
      if (status === "authenticated" && currentUser) {
        await mergeProfileIntoStep1();
      }
      console.error("API Error:", err);
    }
  }

  const parseArrayField = (value: string | string[] | undefined): string[] => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : value.split(",");
      } catch {
        return value.split(",");
      }
    }
    return [];
  };

  async function saveProject(data: RegisterFormValues) {
    try {
      await axios.post(`/api/register-form/`, data);
      if (typeof window !== "undefined") {
        localStorage.removeItem(`formData_${hackathon_id}`);
      }
    } catch (err) {
      console.error("API Error:", err);
    }
  }

  useEffect(() => {
    getHackathon();
    if (status === "authenticated" && currentUser) {
      getRegisterFormLoaded();
    }
  }, [hackathon_id, status, currentUser]);

  useEffect(() => {
    if (status === "authenticated" && currentUser) {
      const values = form.getValues();
      const isEmpty = !values.name && !values.email;
      if (isEmpty) {
        form.reset({
          name: currentUser.name || "",
          email: currentUser.email || "",
        });
      }
    }
  }, [status, currentUser, form]);

  useEffect(() => {
    setDataFromLocalStorage();
  }, [hackathon_id]);

  /** Registration only has steps 1–2; clamp if state ever jumps (e.g. double-click before fix). */
  useEffect(() => {
    if (step > 2) setStep(2);
    if (step < 1) setStep(1);
  }, [step]);

  // Reinitialize form when hackathon data is loaded to use correct resolver
  useEffect(() => {
    if (hackathon) {
      const currentValues = form.getValues();
      form.reset(currentValues);
    }
  }, [hackathon, form]);

  const onSaveLater = async () => {
    if (step === 1) {
      await saveStep1ToProfile();
    }
    const preservedUTMs = getPreservedUTMs();
    const effectiveUTM = utm || preservedUTMs.utm || "";
    
    const formValues = {
      ...form.getValues(),
      hackathon_id: hackathon_id,
      utm: effectiveUTM,
    };
    if (typeof window !== "undefined") {
      localStorage.setItem(
        `formData_${hackathon_id}`,
        JSON.stringify(formValues)
      );
    }
    router.push(`/events/${hackathon_id}`);
  };

  const onSubmit = async (data: RegisterFormValues) => {
    
    if (step < 2) {
      setStep((prev) => (prev < 2 ? prev + 1 : prev));
    } else {
      const errors: any = {};

      if (!data.terms_event_conditions) {
        errors.terms_event_conditions = {
          type: "custom",
          message: "You must agree to participate in any Builder Hub events. Event Terms and Conditions."
        };
      }

      if (!isOnlineHackathon && !data.prohibited_items) {
        errors.prohibited_items = {
          type: "custom",
          message: "You must agree not to bring prohibited items to continue."
        };
      }


      if (Object.keys(errors).length > 0) {
        Object.keys(errors).forEach(field => {
          form.setError(field as keyof RegisterFormValues, errors[field]);
        });
        return;
      }
      setFormData((prevData) => ({ ...prevData, ...data }));
      const preservedUTMs = getPreservedUTMs();
      const effectiveUTM = utm || preservedUTMs.utm || "";
      
      const referrerHandle = getEventReferrer();

      const finalData = {
        ...data,
        hackathon_id: hackathon_id,
        utm: effectiveUTM,
        interests: data.interests ?? [],
        languages: data.languages ?? [],
        roles: data.roles ?? [],
        tools: data.tools,
        // Only include prohibited_items if it's not an online hackathon
        prohibited_items: !isOnlineHackathon ? data.prohibited_items : false,
        ...(referrerHandle ? { referrer_handle: referrerHandle } : {}),
      };

      await saveProject(finalData);
      clearEventReferrer();
      setIsDialogOpen(true);
    }
  };

  const progressPosition = () => {
    switch (step) {
      case 1:
        return "left-0";
      case 2:
        return "right-0";
      default:
        return "left-0";
    }
  };

  const handleStepChange = async (newStep: number) => {
    if (newStep >= 1 && newStep <= 2) {
      if (step === 1 && newStep !== 1) {
        await saveStep1ToProfile();
      }
      setStep(newStep);
    }
  };

  const onNextStep = async () => {
    if (step >= 2 || isAdvancingStepRef.current) return;

    let fieldsToValidate: (keyof RegisterFormValues)[] = [];
    if (step === 1) {
      fieldsToValidate = [
        "name",
        "email",
        "company_name",
        "telegram_user",
        "role",
        "city",
      ];
      const formValues = form.getValues();
      const errors: any = {};

      if (!formValues.name || formValues.name.trim() === "") {
        errors.name = {
          type: "custom",
          message: "Name is required"
        };
      }

      if (!formValues.email || formValues.email.trim() === "") {
        errors.email = {
          type: "custom",
          message: "Invalid email"
        };
      }

      if (!formValues.telegram_user || formValues.telegram_user.trim() === "") {
        errors.telegram_user = {
          type: "custom",
          message: "Telegram username is required"
        };
      }

      if (!formValues.city || formValues.city.trim() === "") {
        errors.city = {
          type: "custom",
          message: "City is required"
        };
      }

      if (Object.keys(errors).length > 0) {
        Object.keys(errors).forEach(field => {
          form.setError(field as keyof RegisterFormValues, errors[field]);
        });
        return;
      }
    } else if (step === 2) {
      fieldsToValidate = [
        "newsletter_subscription",
        "terms_event_conditions",
        "hackathon_participation",
      ];
      if (!isOnlineHackathon) {
        fieldsToValidate.push("prohibited_items");
      }
      const formValues = form.getValues();
      const errors: Partial<Record<keyof RegisterFormValues, { type: string; message: string }>> = {};

      if (!formValues.terms_event_conditions) {
        errors.terms_event_conditions = {
          type: "custom",
          message: "You must agree to participate in any Builder Hub events. Event Terms and Conditions."
        };
      }

      if (!isOnlineHackathon && !formValues.prohibited_items) {
        errors.prohibited_items = {
          type: "custom",
          message: "You must agree not to bring prohibited items to continue."
        };
      }

      if (Object.keys(errors).length > 0) {
        (Object.keys(errors) as (keyof RegisterFormValues)[]).forEach(field => {
          form.setError(field, errors[field]!);
        });
        return;
      }
    }
    const isValid = await form.trigger(fieldsToValidate);
    if (!isValid) return;

    isAdvancingStepRef.current = true;
    try {
      if (step === 1) {
        await saveStep1ToProfile();
      }
      setStep((prev) => (prev < 2 ? prev + 1 : prev));
    } finally {
      isAdvancingStepRef.current = false;
    }
  };

  return (
    <div className="w-full items-center justify-center">
      <h2 className="text-2xl font-bold mb-6 text-foreground">
        {t(lang, "reg.form.title", { title: hackathon?.title ?? "...", step })}
      </h2>
      <div className="relative w-full h-1 bg-zinc-300 dark:bg-zinc-900 mb-4">
        <div
          className={`absolute h-full bg-zinc-800 dark:bg-zinc-300 ${progressPosition()} w-1/2 transition-all duration-300`}
        />
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {step === 1 && <RegisterFormStep1 user={session?.user} lang={lang} />}
          {step === 3 && <RegisterFormStep3 isOnlineHackathon={isOnlineHackathon} lang={lang} />}
          <Separator className="border-red-300 dark:border-red-300 mt-4" />
          <div className="mt-8 flex flex-col md:flex-row md:justify-between md:items-center">
            <div className="order-2 md:order-1 flex gap-x-4">
              {step === 2 && (
                <LoadingButton
                  isLoading={form.formState.isSubmitting}
                  loadingText={t(lang, "reg.form.saving")}
                  variant="red"
                  type="submit"
                  className="bg-red-500 hover:bg-red-600 cursor-pointer"
                >
                  {t(lang, "reg.form.saveExit")}
                </LoadingButton>
              )}

              {step !== 2 && (
                <Button
                  variant="red"
                  type="button"
                  onClick={onNextStep}
                  className="bg-red-500 hover:bg-red-600 cursor-pointer"
                >
                  {t(lang, "reg.form.continue")}
                </Button>
              )}

              {step !== 2 && (
                <LoadingButton
                  isLoading={isSavingLater}
                  loadingText={t(lang, "reg.form.saving")}
                  type="button"
                  onClick={() => {
                    try {
                      setIsSavingLater(true);
                      onSaveLater();
                    } finally {
                      setIsSavingLater(false);
                    }
                  }}
                  className="bg-white text-black border cursor-pointer border-gray-300 hover:text-black hover:bg-gray-100"
                >
                  {t(lang, "reg.form.saveLater")}
                </LoadingButton>
              )}
            </div>

            <div className="order-1 md:order-2 mb-4 md:mb-0 flex flex-col md:flex-row items-center justify-center">
              <div className="flex items-center space-x-1">
                {step > 1 && (
                  <PaginationPrevious
                    className="dark:hover:text-gray-200 cursor-pointer"
                    label={t(lang, "reg.form.previous")}
                    onClick={() => setStep(step - 1)}
                  />
                )}
                <Pagination>
                  <PaginationContent>
                    {Array.from({ length: 2 }, (_, i) => i + 1).map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          isActive={step === page}
                          className="cursor-pointer"
                          onClick={() => handleStepChange(page)}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                  </PaginationContent>
                </Pagination>
                {step < 2 && (
                  <PaginationNext
                    className="dark:hover:text-gray-200 cursor-pointer"
                    label={t(lang, "reg.form.next")}
                    onClick={onNextStep}
                  />
                )}
              </div>
              <span className="font-Aeonik text-xs sm:text-sm mt-2 md:mt-0 md:ml-2">
                Step {step} of 2
              </span>
            </div>
          </div>
        </form>
      </Form>

      <ProcessCompletedDialog
        hackathon_id={hackathon_id as string}
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        lang={lang}
      />
    </div>
  );
}
