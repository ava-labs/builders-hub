import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zodResolver";
import { z } from "zod";
import { useSession } from "next-auth/react";
import { toast as sonnerToast } from "sonner";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { LINKEDIN_ACCOUNT_PATTERN, TELEGRAM_ACCOUNT_PATTERN } from "@/lib/profile/socialAccountValidation";

export const profileSchema = z.object({
  // optional: a new user with no name can still save other fields. save()
  // keeps a stored name from being cleared.
  name: z.string().trim().optional(),
  username: z.string().optional(),
  bio: z.string().max(250, "Enter a bio of 250 characters or fewer.").optional(),
  email: z.email("Enter a valid email address.").optional(),
  image: z.string().optional(),
  country: z.string().optional(),
  is_student: z.boolean().optional().default(false),
  is_founder: z.boolean().optional().default(false),
  is_employee: z.boolean().optional().default(false),
  is_developer: z.boolean().optional().default(false),
  is_enthusiast: z.boolean().optional().default(false),
  founder_company_name: z.string().optional(),
  employee_company_name: z.string().optional(),
  employee_role: z.string().optional(),
  student_institution: z.string().optional(),
  company_name: z.string().optional(),
  role: z.string().optional(),
  // read-only here: the OAuth link and disconnect routes own them, and the
  // PUT does not send them, so a stored value never blocks a save
  github_account: z.string().optional().default(""),
  x_account: z.string().optional().default(""),
  linkedin_account: z
    .union([
      z
        .string()
        .regex(
          LINKEDIN_ACCOUNT_PATTERN,
          "Enter a LinkedIn username that has only letters, numbers, dots, dashes or underscores.",
        ),
      z.literal(""),
    ])
    .optional()
    .default(""),
  wallet: z.array(z.string()).optional().default([]),
  additional_social_accounts: z
    .array(z.url("Enter a website address, for example https://example.com."))
    .optional()
    .default([]),
  skills: z.array(z.string()).default([]),
  notifications: z.boolean().default(false),
  profile_privacy: z.string().default("public"),
  telegram_account: z
    .union([
      z
        .string()
        .regex(TELEGRAM_ACCOUNT_PATTERN, "Enter a Telegram username of 5 to 32 characters that starts with a letter."),
      z.literal(""),
    ])
    .optional()
    .default(""),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

/** what a save did: the caller tells the user. A failure names the first
    field with an error, so the caller can open its section and focus it. */
export type SaveResult =
  | { ok: true }
  | { ok: false; message: string; field?: keyof ProfileFormValues };

const CHECK_FIELDS = "Check the fields marked in red.";

/* One save model: the user edits, then saves or discards. Nothing saves in
   the background, so Discard always undoes and the bar never lies. The form
   does not send notifications or profile_privacy: Settings owns them. */

export function useProfileForm() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [githubConnected, setGithubConnected] = useState(false);

  // Initialize form with react-hook-form and Zod
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      username: "",
      bio: "",
      email: session?.user?.email || "",
      image: "",
      country: "",
      is_student: false,
      is_founder: false,
      is_employee: false,
      is_developer: false,
      is_enthusiast: false,
      founder_company_name: "",
      employee_company_name: "",
      employee_role: "",
      student_institution: "",
      company_name: "",
      role: "",
      github_account: "",
      x_account: "",
      linkedin_account: "",
      wallet: [],
      additional_social_accounts: [],
      skills: [],
      notifications: false,
      profile_privacy: "public",
      telegram_account: "",
    },
  });

  const { watch, setValue, formState } = form;
  const watchedValues = watch();

  // GitHub, X and the photo have no input: OAuth links the accounts and
  // /api/profile/photo saves the photo. Register them so resetField can set
  // them after a disconnect or a photo change. On every render, not once:
  // form.reset() (the profile load) clears the registered fields.
  form.register("github_account");
  form.register("x_account");
  form.register("image");

  const loadProfile = useCallback(async () => {
    if (!session?.user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/profile/extended/${session.user.id}`);

      if (response.ok) {
        const profile = await response.json();

        const formValues = {
          name: profile.name || "",
          username: profile.username || "",
          bio: profile.bio || "",
          email: profile.email || session.user.email || "",
          notification_email: profile.notification_email || "",
          image: profile.image || "",
          country: profile.country || "",
          is_student: profile.user_type?.is_student ?? false,
          is_founder: profile.user_type?.is_founder ?? false,
          is_employee: profile.user_type?.is_employee ?? false,
          is_developer: profile.user_type?.is_developer ?? false,
          is_enthusiast: profile.user_type?.is_enthusiast ?? false,
          founder_company_name: profile.user_type?.founder_company_name || "",
          employee_company_name: profile.user_type?.employee_company_name || "",
          employee_role: profile.user_type?.employee_role || "",
          student_institution: profile.user_type?.student_institution || "",
          company_name: profile.user_type?.company_name || "",
          role: profile.user_type?.role || "",
          github_account: profile.github_account || "",
          x_account: profile.x_account || "",
          linkedin_account: profile.linkedin_account || "",
          wallet: Array.isArray(profile.wallet) ? profile.wallet : (profile.wallet ? [profile.wallet] : []),
          additional_social_accounts: profile.additional_social_accounts || [],
          skills: profile.skills || [],
          notifications: profile.notifications || false,
          profile_privacy: profile.profile_privacy || "public",
          telegram_account: profile.telegram_account || "",
        };

        setGithubConnected(Boolean(profile.githubConnected));
        form.reset(formValues);
        setLoadFailed(false);
      } else {
        setLoadFailed(true);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id, session?.user?.email, form]);
  
  // Surface the result of an X/GitHub OAuth link redirect, then strip the
  // status params from the URL. Uses sonner: the global toaster in
  // app/layout.client.tsx is sonner, so useToast() toasts never render here.
  useEffect(() => {
    const gh = searchParams.get('gh');
    const x = searchParams.get('x');
    if (!gh && !x) return;

    const notify = (status: string, network: 'X' | 'GitHub', site: string) => {
      const id = `link-${network}`;
      if (status === 'linked') {
        sonnerToast.success(`${network} connected`, { id });
      } else if (status === 'already_linked') {
        sonnerToast.error(
          `That ${network} account is already linked to a different profile. ` +
            `Log in to ${site} with the account you want to connect, then try again.`,
          { id, duration: 10000 },
        );
      } else {
        sonnerToast.error(`Could not connect ${network}. Please try again.`, { id });
      }
    };
    // Defer past this commit's effect phase: sonner's <Toaster> (mounted after
    // {children} in the root layout) subscribes in its own mount effect, which
    // runs AFTER this one, so a toast dispatched synchronously here is dropped.
    setTimeout(() => {
      if (x) notify(x, 'X', 'x.com');
      if (gh) notify(gh, 'GitHub', 'github.com');
    }, 0);

    // The link routes return to ?tab=personal; the accounts live in their own
    // section, so open that one.
    const params = new URLSearchParams(searchParams.toString());
    params.delete('gh');
    params.delete('x');
    params.set('tab', 'accounts');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, []);

  // Load profile data on component mount
  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Update email when session is available
  useEffect(() => {
    if (session?.user?.email && !isLoading) {
      form.setValue("email", session.user.email);
    }
  }, [session?.user?.email, form, isLoading]);

  // Save the form. Resolves with what happened, so the caller never reports
  // a save that did not happen.
  const saveValues = async (data: ProfileFormValues): Promise<SaveResult> => {
    if (!session?.user?.id) {
      return { ok: false, message: "Sign in to save your profile." };
    }

    // Only format validations - no required fields
    let hasErrors = false;

    // Validate wallet format if provided (validate each wallet in the array)
    if (data.wallet && Array.isArray(data.wallet) && data.wallet.length > 0) {
      const invalidWallets = data.wallet.filter(
        (wallet) => wallet && wallet.trim() !== "" && !/^0x[a-fA-F0-9]{40}$/.test(wallet.trim())
      );
      
      if (invalidWallets.length > 0) {
        form.setError("wallet", {
          type: "manual",
          message: `${
            invalidWallets.length === 1
              ? `The wallet address ${invalidWallets[0].trim()} is not valid.`
              : `These wallet addresses are not valid: ${invalidWallets.map((w) => w.trim()).join(", ")}.`
          } A C-Chain address is 0x and 40 hex characters.`,
        });
        hasErrors = true;
      }
    }

    if (hasErrors) {
      return { ok: false, message: CHECK_FIELDS, field: "wallet" };
    }

    setIsSaving(true);

    try {
      // Build user_type object to send as JSON
      const {
        is_student,
        is_founder,
        is_employee,
        is_developer,
        is_enthusiast,
        founder_company_name,
        employee_company_name,
        employee_role,
        student_institution,
        company_name,
        role,
        wallet,
        name,
        github_account: _githubAccount,
        x_account: _xAccount,
        notifications: _notifications,
        profile_privacy: _profilePrivacy,
        ...restData
      } = data;

      // Clean wallet array: remove empty strings and duplicates
      const cleanedWallets = Array.isArray(wallet)
        ? [...new Set(wallet.filter(w => w && w.trim() !== ""))]
        : [];

      const profileData = {
        ...restData,
        // the server rejects a blank name but accepts a missing one
        ...(name?.trim() ? { name: name.trim() } : {}),
        wallet: cleanedWallets.length > 0 ? cleanedWallets : [],
        user_type: {
          is_student,
          is_founder,
          is_employee,
          is_developer,
          is_enthusiast,
          ...(founder_company_name && { founder_company_name }),
          ...(employee_company_name && { employee_company_name }),
          ...(employee_role && { employee_role }),
          ...(student_institution && { student_institution }),
          // Legacy fields for backward compatibility
          ...(company_name && { company_name }),
          ...(role && { role }),
        }
      };

      const response = await fetch(`/api/profile/extended/${session.user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      });
      
      if (!response.ok) {
        // a 4xx says what to fix; a 5xx text ("Internal Server Error") does not
        const errorData = response.status < 500 ? await response.json().catch(() => ({})) : {};
        throw new Error(errorData.error || 'Could not save your profile. Try again.');
      }

      const updatedProfile = await response.json();
      
      // Rebuild form data from response
      const newFormData = {
        name: updatedProfile.name || "",
        username: updatedProfile.username || "",
        bio: updatedProfile.bio || "",
        email: updatedProfile.email || session.user.email || "",
        notification_email: updatedProfile.notification_email || "",
        image: updatedProfile.image || "",
        country: updatedProfile.country || "",
        is_student: updatedProfile.user_type?.is_student || false,
        is_founder: updatedProfile.user_type?.is_founder || false,
        is_employee: updatedProfile.user_type?.is_employee || false,
        is_developer: updatedProfile.user_type?.is_developer || false,
        is_enthusiast: updatedProfile.user_type?.is_enthusiast || false,
        founder_company_name: updatedProfile.user_type?.founder_company_name || "",
        employee_company_name: updatedProfile.user_type?.employee_company_name || "",
        employee_role: updatedProfile.user_type?.employee_role || "",
        student_institution: updatedProfile.user_type?.student_institution || "",
        company_name: updatedProfile.user_type?.company_name || "",
        role: updatedProfile.user_type?.role || "",
        github_account: updatedProfile.github_account || "",
        x_account: updatedProfile.x_account || "",
        linkedin_account: updatedProfile.linkedin_account || "",
        wallet: Array.isArray(updatedProfile.wallet) ? updatedProfile.wallet : (updatedProfile.wallet ? [updatedProfile.wallet] : []),
        additional_social_accounts: updatedProfile.additional_social_accounts || [],
        skills: updatedProfile.skills || [],
        notifications: updatedProfile.notifications || false,
        profile_privacy: updatedProfile.profile_privacy || "public",
        telegram_account: updatedProfile.telegram_account || "",
      };

      form.reset(newFormData);
      return { ok: true };
    } catch (error) {
      console.error("Error saving profile:", error);
      return { ok: false, message: error instanceof Error ? error.message : "Could not save your profile." };
    } finally {
      setIsSaving(false);
    }
  };

  // Validate, then save. A form that does not validate resolves as not saved,
  // with the first field that has an error. The name is optional for a user
  // who never set one, but a stored name cannot be cleared.
  const save = () =>
    new Promise<SaveResult>((resolve) => {
      void form.handleSubmit(
        async (data) => {
          const storedName = (form.formState.defaultValues?.name ?? "").trim();
          if (!data.name?.trim() && storedName) {
            form.setError("name", { type: "manual", message: "Enter your full name." });
            resolve({ ok: false, message: CHECK_FIELDS, field: "name" });
            return;
          }
          resolve(await saveValues(data));
        },
        (errors) =>
          resolve({
            ok: false,
            message: CHECK_FIELDS,
            field: Object.keys(errors)[0] as keyof ProfileFormValues | undefined,
          }),
      )();
    });

  // Skill handlers
  const handleAddSkill = (newSkill: string, setNewSkill: (skill: string) => void) => {
    const currentSkills = watchedValues.skills || [];
    if (newSkill.trim() && !currentSkills.includes(newSkill.trim())) {
      setValue("skills", [...currentSkills, newSkill.trim()], { shouldDirty: true });
      setNewSkill("");
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    const currentSkills = watchedValues.skills || [];
    setValue("skills", currentSkills.filter((skill) => skill !== skillToRemove), { shouldDirty: true });
  };

  // Social handlers
  const handleAddSocial = () => {
    const currentSocials = watchedValues.additional_social_accounts || [];
    setValue("additional_social_accounts", [...currentSocials, ""], { shouldDirty: true });
  };

  const handleRemoveSocial = (index: number) => {
    const currentSocials = watchedValues.additional_social_accounts || [];
    setValue("additional_social_accounts", currentSocials.filter((_, i) => i !== index), { shouldDirty: true });
  };

  // Wallet handlers
  const handleAddWallet = (address: string) => {
    const currentWallets = watchedValues.wallet || [];
    const trimmedAddress = address?.trim() ?? "";
    if (trimmedAddress === "" || !/^0x[a-fA-F0-9]{40}$/.test(trimmedAddress)) return;
    // Evitar duplicados (comparación case-insensitive: las direcciones Ethereum son la misma con distinta capitalización)
    const isDuplicate = currentWallets.some(
      (w) => w.toLowerCase() === trimmedAddress.toLowerCase()
    );
    if (!isDuplicate) {
      setValue("wallet", [...currentWallets, trimmedAddress], { shouldDirty: true });
    }
  };

  const handleRemoveWallet = (index: number) => {
    const currentWallets = watchedValues.wallet || [];
    setValue("wallet", currentWallets.filter((_, i) => i !== index), { shouldDirty: true });
  };

  return {
    form,
    watchedValues,
    isLoading,
    loadFailed,
    reload: loadProfile,
    isSaving,
    githubConnected,
    setGithubConnected,
    handleAddSkill,
    handleRemoveSkill,
    handleAddSocial,
    handleRemoveSocial,
    handleAddWallet,
    handleRemoveWallet,
    save,
  };
}
