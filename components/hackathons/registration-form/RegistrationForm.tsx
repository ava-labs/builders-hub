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
import { normalizeEventsLang, t } from "@/lib/events/i18n";
import { clearStoredReferralAttribution } from "@/lib/referrals/client";
import {
  ReferralFormSection,
  buildReferralAttributionPayload,
} from "@/components/referrals/ReferralFormSection";
import { EMPTY_REFERRER, type ReferrerPickerValue } from "@/components/referrals/ReferrerPicker";
import { TeamFormation } from "./TeamFormation";
import { getTeamSizeRange, hasTeamPicker } from "@/lib/hackathons/teamSizeDefaults";
import { isTeam1Event } from "@/lib/events/team1";
import {
  GITHUB_ACCOUNT_PATTERN,
  TELEGRAM_ACCOUNT_PATTERN,
  X_ACCOUNT_PATTERN,
} from "@/lib/profile/socialAccountValidation";

const optionalSocial = (pattern: RegExp, message: string) =>
  z
    .string()
    .optional()
    .default("")
    .refine((value) => !value || pattern.test(value.trim()), { message });

const requiredSocial = (pattern: RegExp, requiredMessage: string, formatMessage: string) =>
  z
    .string()
    .trim()
    .min(1, requiredMessage)
    .refine((value) => pattern.test(value), { message: formatMessage });

const createRegisterSchema = (isOnline: boolean) => z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  company_name: z.string().optional(),
  role: z.string().optional(),
  is_student: z.boolean().optional().default(false),
  student_institution: z.string().optional(),
  is_founder: z.boolean().optional().default(false),
  founder_company_name: z.string().optional(),
  is_employee: z.boolean().optional().default(false),
  employee_company_name: z.string().optional(),
  employee_role: z.string().optional(),
  is_developer: z.boolean().optional().default(false),
  is_enthusiast: z.boolean().optional().default(false),
  city: z.string().min(1, "City is required"),
  interests: z.array(z.string()).optional(),
  web3_proficiency: z.string().optional(),
  tools: z.array(z.string()).optional(),
  roles: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  hackathon_participation: z.string().optional(),
  dietary: z.string().optional().default(""),
  github_account: optionalSocial(
    GITHUB_ACCOUNT_PATTERN,
    "Enter your GitHub username or https://github.com/<username>",
  ),
  telegram_account: requiredSocial(
    TELEGRAM_ACCOUNT_PATTERN,
    "Telegram username is required",
    "Enter a valid Telegram handle (5-32 chars, letters/digits/underscore)",
  ),
  x_account: optionalSocial(
    X_ACCOUNT_PATTERN,
    "Enter your X handle (without @) or https://x.com/<handle>",
  ),
  terms_event_conditions: z.boolean().optional(),
  newsletter_subscription: z.boolean().default(false).optional(),
  prohibited_items: z.boolean().optional(),
  founder_check: z.boolean().optional(),
  avalanche_ecosystem_member: z.boolean().optional(),
  user_notifications: z.boolean().optional(),
  user_consent_sharing: z.boolean().optional(),
});

export const registerSchema = createRegisterSchema(false);

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
  const [hackathon, setHackathon] = useState<HackathonHeader | null>(null);
  const [formLoaded, setRegistrationForm] = useState<RegistrationForm | null>(
    null
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const router = useRouter();
  const [isSavingLater, setIsSavingLater] = useState(false);
  const isAdvancingStepRef = useRef(false);
  const [referrer, setReferrer] = useState<ReferrerPickerValue>(EMPTY_REFERRER);
  const [countryLocked, setCountryLocked] = useState(false);
  const [teamSize, setTeamSize] = useState<number>(1);
  const [teammateEmails, setTeammateEmails] = useState<string[]>([]);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [userConsentState, setUserConsentState] = useState<{
    notifications: boolean | null;
    consent_sharing: boolean | null;
  }>({ notifications: null, consent_sharing: null });
  const [consentsLoaded, setConsentsLoaded] = useState(false);

  const isOnlineHackathon = hackathon?.location?.toLowerCase().includes("online") || false;
  const showNotificationsConsent =
    consentsLoaded && userConsentState.notifications !== true;
  const showSharingConsent =
    consentsLoaded && userConsentState.consent_sharing !== true;
  // Team1-organized / co-hosted events require the `consent_sharing` opt-in
  // unless the user has already granted it on their profile.
  const isTeam1 = hackathon
    ? isTeam1Event({ organizers: hackathon.organizers, cohosts: hackathon.cohosts })
    : false;
  const requireSharingConsent =
    isTeam1 && consentsLoaded && userConsentState.consent_sharing !== true;
  const lang = normalizeEventsLang(hackathon?.content?.language);
  const registrationMode: "full" | "simple" = hackathon?.content?.registration_mode === "simple" ? "simple" : "full";
  const isSimpleMode = registrationMode === "simple";
  const totalSteps = isSimpleMode ? 1 : 2;
  
  const getDefaultValues = () => ({
    
    name: currentUser?.name || "",
    email: currentUser?.email || "",
    company_name: "",
    role: "",
    is_student: false,
    student_institution: "",
    is_founder: false,
    founder_company_name: "",
    is_employee: false,
    employee_company_name: "",
    employee_role: "",
    is_developer: false,
    is_enthusiast: false,
    city: "",
    dietary: "",
    interests: [],
    web3_proficiency: "",
    tools: [],
    roles: [],
    languages: [],
    hackathon_participation: "",
    github_account: "",
    telegram_account: "",
    x_account: "",
    terms_event_conditions: false,
    newsletter_subscription: false,
    prohibited_items: false,
    founder_check: false,
    avalanche_ecosystem_member: false,
    user_notifications: false,
    user_consent_sharing: false,
  });

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(createRegisterSchema(isOnlineHackathon)),
    defaultValues: getDefaultValues(),
  });

  function setDataFromLocalStorage() {
    if (typeof window !== "undefined") {
      const savedData = localStorage.getItem(`formData_${hackathon_id}`);

      if (savedData) {
        const { hackathon_id: hackathon_id_local } = JSON.parse(savedData);
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
      const content = response.data?.content;
      const range = getTeamSizeRange({
        team_size_min: content?.team_size_min,
        team_size_max: content?.team_size_max,
      });
      setTeamSize(range.min);
    } catch (err) {
      console.error("API Error:", err);
    }
  }

  async function mergeProfileIntoStep1() {
    const userId = (currentUser as { id?: string })?.id;
    if (!userId) return;
    try {
      const profileRes = await fetch(`/api/profile/extended/${userId}`);
      if (!profileRes.ok) return;
      const profile = await profileRes.json();
      setUserConsentState({
        notifications: typeof profile.notifications === "boolean" ? profile.notifications : null,
        consent_sharing: typeof profile.consent_sharing === "boolean" ? profile.consent_sharing : null,
      });
      setConsentsLoaded(true);
      if (typeof profile.country === "string" && profile.country.trim().length > 0) {
        setCountryLocked(true);
      }
      const current = form.getValues();
      const merged = {
        ...current,
        name:  profile.name || current.name || "",
        email:  profile.email || current.email || "",
        city:  profile.country || current.city || "",
        telegram_account:  profile.telegram_account || current.telegram_account || "",
        x_account:  profile.x_account || current.x_account || "",
        github_account:  profile.github_account || current.github_account || "",
        company_name:  profile.user_type?.company_name || profile.user_type?.founder_company_name || profile.user_type?.employee_company_name || profile.user_type?.student_institution || current.company_name || "",
        role:  profile.user_type?.employee_role || profile.user_type?.role || current.role || "",
        is_student: profile.user_type?.is_student ?? current.is_student ?? false,
        student_institution: profile.user_type?.student_institution || current.student_institution || "",
        is_founder: profile.user_type?.is_founder ?? current.is_founder ?? false,
        founder_company_name: profile.user_type?.founder_company_name || current.founder_company_name || "",
        is_employee: profile.user_type?.is_employee ?? current.is_employee ?? false,
        employee_company_name: profile.user_type?.employee_company_name || current.employee_company_name || "",
        employee_role: profile.user_type?.employee_role || current.employee_role || "",
        is_developer: profile.user_type?.is_developer ?? current.is_developer ?? false,
        is_enthusiast: profile.user_type?.is_enthusiast ?? current.is_enthusiast ?? false,
        founder_check: profile.user_type?.founder_check ?? current.founder_check ?? false,
        avalanche_ecosystem_member: profile.user_type?.avalanche_ecosystem_member ?? current.avalanche_ecosystem_member ?? false,
      };
      form.reset(merged);
    } catch (err) {
      console.error("Error merging profile into registration form:", err);
    }
  }

  async function saveStep1ToProfile() {
    const userId = (currentUser as { id?: string })?.id;
    if (!userId) return;
    const step1 = form.getValues();
    try {
      const profileRes = await fetch(`/api/profile/extended/${userId}`);
      if (!profileRes.ok) return;
      const existing = await profileRes.json();
      const userType = existing.user_type || {};
      const roleCompany =
        (step1.is_founder ? step1.founder_company_name : "") ||
        (step1.is_employee ? step1.employee_company_name : "") ||
        (step1.is_student ? step1.student_institution : "") ||
        step1.company_name ||
        "";
      const roleLabel =
        (step1.is_employee ? step1.employee_role : "") ||
        step1.role ||
        "";

      const payload = {
        name: step1.name ?? existing.name,
        email: step1.email ?? existing.email,
        country: (step1.city ?? "").trim() || existing.country,
        telegram_account: (step1.telegram_account ?? "").trim() || existing.telegram_account,
        user_type: {
          ...userType,
          is_student: Boolean(step1.is_student),
          is_founder: Boolean(step1.is_founder),
          is_employee: Boolean(step1.is_employee),
          is_developer: Boolean(step1.is_developer),
          is_enthusiast: Boolean(step1.is_enthusiast),
          student_institution: (step1.student_institution ?? "").trim(),
          founder_company_name: (step1.founder_company_name ?? "").trim(),
          employee_company_name: (step1.employee_company_name ?? "").trim(),
          employee_role: (step1.employee_role ?? "").trim(),
          company_name: roleCompany.trim() || userType.company_name,
          role: roleLabel.trim() || userType.role,
          founder_check: Boolean(step1.founder_check),
          avalanche_ecosystem_member: Boolean(step1.avalanche_ecosystem_member),
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
          is_student: loadedData.is_student || false,
          student_institution: loadedData.student_institution || "",
          is_founder: loadedData.is_founder || false,
          founder_company_name: loadedData.founder_company_name || "",
          is_employee: loadedData.is_employee || false,
          employee_company_name: loadedData.employee_company_name || "",
          employee_role: loadedData.employee_role || "",
          is_developer: loadedData.is_developer || false,
          is_enthusiast: loadedData.is_enthusiast || false,
          city: loadedData.city || "",
          dietary: loadedData.dietary || "",
          telegram_account: loadedData.telegram_account || "",
          x_account: loadedData.x_account || "",
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
          github_account: loadedData.github_portfolio || "",
          terms_event_conditions: loadedData.terms_event_conditions || false,
          newsletter_subscription: loadedData.newsletter_subscription || false,
          prohibited_items: !isOnlineHackathon ? (loadedData.prohibited_items || false) : false,
          founder_check: loadedData.founder_check || false,
          avalanche_ecosystem_member: loadedData.avalanche_ecosystem_member || false,
        };
        hackathon_id = loadedData.hackathon_id;
        form.reset(parsedData);
        setRegistrationForm(loadedData);
        if (loadedData.referralAttribution) {
          const ra = loadedData.referralAttribution;
          setReferrer({
            teamId: ra.team_id_referrer ?? null,
            teamIdOther: ra.team_id_referrer_other ?? null,
            userId: ra.user_id_referrer ?? null,
          });
        }
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
      const { user_notifications, user_consent_sharing, github_account, ...registerData } = data;
      const userConsents: { notifications?: boolean; consent_sharing?: boolean } = {};
      if (showNotificationsConsent && typeof user_notifications === "boolean") {
        userConsents.notifications = user_notifications;
      }
      if (showSharingConsent && typeof user_consent_sharing === "boolean") {
        userConsents.consent_sharing = user_consent_sharing;
      }
      const payload = {
        ...registerData,
        github_portfolio: github_account ?? "",
        ...(Object.keys(userConsents).length > 0 ? { user_consents: userConsents } : {}),
      };
      const response = await axios.post(`/api/register-form/`, payload);
      if (typeof window !== "undefined") {
        localStorage.removeItem(`formData_${hackathon_id}`);
      }
      return response.data as {
        referralAttributed?: boolean;
        warning?: string;
        failedInvites?: string[];
      };
    } catch (err) {
      console.error("API Error:", err);
      throw err;
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

  useEffect(() => {
    if (step > totalSteps) setStep(totalSteps);
    if (step < 1) setStep(1);
  }, [step, totalSteps]);

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
    const formValues = {
      ...form.getValues(),
      hackathon_id: hackathon_id,
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
    if (!isSimpleMode && step < 2) {
      setStep((prev) => (prev < 2 ? prev + 1 : prev));
    } else {
      setTeamError(null);
      const errors: any = {};

      if (!data.terms_event_conditions) {
        errors.terms_event_conditions = {
          type: "custom",
          message: "You must agree to participate in any Builder Hub events. Event Terms and Conditions."
        };
      }

      if (!isSimpleMode && !isOnlineHackathon && !data.prohibited_items) {
        errors.prohibited_items = {
          type: "custom",
          message: "You must agree not to bring prohibited items to continue."
        };
      }

      if (requireSharingConsent && data.user_consent_sharing !== true) {
        errors.user_consent_sharing = {
          type: "custom",
          message: t(lang, "consents.consentSharing.required"),
        };
      }

      const range = getTeamSizeRange({
        team_size_min: hackathon?.content?.team_size_min,
        team_size_max: hackathon?.content?.team_size_max,
      });
      const maxTeammates =
        range.max !== undefined ? Math.max(0, range.max - 1) : Infinity;
      const cleanedTeammates = teammateEmails
        .map((e) => e.trim())
        .filter((e) => e.length > 0)
        .slice(0, Number.isFinite(maxTeammates) ? (maxTeammates as number) : undefined);
      const effectiveTeamSize = Math.min(
        range.max ?? Number.MAX_SAFE_INTEGER,
        Math.max(teamSize, 1 + cleanedTeammates.length),
      );
      const expectedTeammates = Math.max(0, teamSize - 1);
      if (effectiveTeamSize < range.min) {
        setTeamError(
          lang === "es"
            ? `Este evento requiere un equipo de al menos ${range.min} personas.`
            : `This event requires a team of at least ${range.min}.`,
        );
        errors.__team = true;
      } else if (cleanedTeammates.length < expectedTeammates) {
        setTeamError(
          lang === "es"
            ? "Completa el correo de todos tus compañeros o cambia el tamaño del equipo."
            : "Fill in every teammate email, or change the team size.",
        );
        errors.__team = true;
      } else {
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const badIdx = cleanedTeammates.findIndex((e) => !emailRe.test(e));
        if (badIdx >= 0) {
          setTeamError(
            lang === "es"
              ? "Uno de los correos de tu equipo no es válido."
              : "One of the teammate emails is not valid.",
          );
          errors.__team = true;
        }
        const selfEmail = (currentUser?.email ?? data.email ?? "").trim().toLowerCase();
        if (selfEmail && cleanedTeammates.some((e) => e.toLowerCase() === selfEmail)) {
          setTeamError(
            lang === "es"
              ? "No puedes invitarte a ti mismo como compañero."
              : "You can't invite yourself as a teammate.",
          );
          errors.__team = true;
        }
        const lowercased = cleanedTeammates.map((e) => e.toLowerCase());
        if (new Set(lowercased).size !== lowercased.length) {
          setTeamError(
            lang === "es"
              ? "Hay correos repetidos en tu equipo."
              : "Duplicate teammate emails are not allowed.",
          );
          errors.__team = true;
        }
      }


      if (Object.keys(errors).length > 0) {
        Object.keys(errors).forEach(field => {
          if (field === "__team") return;
          form.setError(field as keyof RegisterFormValues, errors[field]);
        });
        const firstField = Object.keys(errors).find((k) => k !== "__team")
          ?? "__team";
        if (typeof window !== "undefined") {
          const el = document.querySelector<HTMLElement>(
            `[name="${firstField}"], #${CSS.escape(firstField)}`,
          );
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        return;
      }
      setTeamError(null);
      setFormData((prevData) => ({ ...prevData, ...data }));

      const finalData = {
        ...data,
        hackathon_id: hackathon_id,
        ...buildReferralAttributionPayload(referrer),
        interests: data.interests ?? [],
        languages: data.languages ?? [],
        roles: data.roles ?? [],
        tools: data.tools,
        prohibited_items: !isOnlineHackathon ? data.prohibited_items : false,
        teammates: cleanedTeammates,
      };

      const result = await saveProject(finalData);
      if (result.referralAttributed) {
        clearStoredReferralAttribution();
      }
      if (Array.isArray(result.failedInvites) && result.failedInvites.length > 0) {
        const failed = result.failedInvites.join(", ");
        setTeamError(
          lang === "es"
            ? `Tu registro se guardó, pero no se pudieron enviar algunas invitaciones (${failed}). Puedes reenviarlas desde la página de tu proyecto.`
            : `Your registration was saved, but some invites couldn't be sent (${failed}). You can re-invite them from your project page.`,
        );
      }
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
    if (newStep >= 1 && newStep <= totalSteps) {
      if (step === 1 && newStep !== 1) {
        await saveStep1ToProfile();
      }
      setStep(newStep);
    }
  };

  const onNextStep = async () => {
    if (step >= totalSteps || isAdvancingStepRef.current) return;

    let fieldsToValidate: (keyof RegisterFormValues)[] = [];
    if (step === 1) {
      fieldsToValidate = [
        "name",
        "email",
        "company_name",
        "role",
        "city",
        "telegram_account",
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

      if (!formValues.city || formValues.city.trim() === "") {
        errors.city = {
          type: "custom",
          message: "City is required"
        };
      }

      const telegramHandle = (formValues.telegram_account ?? "").trim();
      if (!telegramHandle) {
        errors.telegram_account = {
          type: "custom",
          message: "Telegram username is required",
        };
      } else if (!TELEGRAM_ACCOUNT_PATTERN.test(telegramHandle)) {
        errors.telegram_account = {
          type: "custom",
          message: "Enter a valid Telegram handle (5-32 chars, letters/digits/underscore)",
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

      if (requireSharingConsent && formValues.user_consent_sharing !== true) {
        errors.user_consent_sharing = {
          type: "custom",
          message: t(lang, "consents.consentSharing.required"),
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
          {step === 1 && (
            <>
              <RegisterFormStep1
                user={session?.user}
                lang={lang}
                mode={registrationMode}
                countryLocked={countryLocked}
                requireSocials={isSimpleMode}
              />
              {hackathon_id && hasTeamPicker(
                getTeamSizeRange({
                  team_size_min: hackathon?.content?.team_size_min,
                  team_size_max: hackathon?.content?.team_size_max,
                })
              ) && (
                <div id="__team">
                  <TeamFormation
                    hackathonId={hackathon_id}
                    hackathon={{
                      team_size_min: hackathon?.content?.team_size_min,
                      team_size_max: hackathon?.content?.team_size_max,
                    }}
                    selectedSize={teamSize}
                    onSizeChange={(s) => {
                      setTeamSize(s);
                      setTeamError(null);
                    }}
                    teammates={teammateEmails}
                    onTeammatesChange={(e) => {
                      setTeammateEmails(e);
                      setTeamError(null);
                    }}
                    inviterEmail={currentUser?.email ?? undefined}
                    lang={lang}
                  />
                  {teamError && (
                    <p className="mt-2 text-sm text-red-500">{teamError}</p>
                  )}
                </div>
              )}
              <ReferralFormSection
                value={referrer}
                onChange={setReferrer}
                title={t(lang, "reg.referral.title")}
                description={t(lang, "reg.referral.description")}
                lang={lang}
              />
            </>
          )}
          {!isSimpleMode && step === 2 && (
            <RegisterFormStep3
              isOnlineHackathon={isOnlineHackathon}
              lang={lang}
              showNotificationsConsent={showNotificationsConsent}
              showSharingConsent={showSharingConsent}
              requireSharingConsent={requireSharingConsent}
            />
          )}
          {isSimpleMode && step === 1 && (
            <>
              <div className="mt-6 flex items-start gap-3">
                <input
                  id="terms_event_conditions"
                  type="checkbox"
                  checked={!!form.watch("terms_event_conditions")}
                  onChange={(e) =>
                    form.setValue("terms_event_conditions", e.target.checked, { shouldDirty: true })
                  }
                  className="mt-1 h-4 w-4"
                />
                <label htmlFor="terms_event_conditions" className="text-sm cursor-pointer">
                  {t(lang, "reg.step3.terms.label")}{" "}
                  <a
                    href="https://assets.website-files.com/602e8e4411398ca20cfcafd3/63fe6be7e0d14da8cbdb9984_Avalanche%20Events%20Participation%20Terms%20and%20Conditions%20(Final_28Feb2023).docx.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t(lang, "reg.step3.terms.link")}
                  </a>
                  {t(lang, "reg.step3.terms.connector")}
                  <a
                    href="https://www.avax.network/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t(lang, "reg.step3.privacyLink")}
                  </a> *
                </label>
              </div>
            </>
          )}
          {isSimpleMode &&
            step === 1 &&
            form.formState.errors.terms_event_conditions && (
              <p className="text-sm text-red-500 mt-1">
                {form.formState.errors.terms_event_conditions.message as string}
              </p>
            )}
          <Separator className="border-red-300 dark:border-red-300 mt-4" />
          <div className="mt-8 flex flex-col md:flex-row md:justify-between md:items-center">
            <div className="order-2 md:order-1 flex gap-x-4">
              {step === totalSteps && (
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

              {step !== totalSteps && (
                <Button
                  variant="red"
                  type="button"
                  onClick={onNextStep}
                  className="bg-red-500 hover:bg-red-600 cursor-pointer"
                >
                  {t(lang, "reg.form.continue")}
                </Button>
              )}

              {step !== totalSteps && (
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
              {totalSteps > 1 && (
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
                      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((page) => (
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
                  {step < totalSteps && (
                    <PaginationNext
                      className="dark:hover:text-gray-200 cursor-pointer"
                      label={t(lang, "reg.form.next")}
                      onClick={onNextStep}
                    />
                  )}
                </div>
              )}
              <span className="font-Aeonik text-xs sm:text-sm mt-2 md:mt-0 md:ml-2">
                Step {step} of {totalSteps}
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
        isUpdate={!!formLoaded}
      />
    </div>
  );
}
