import { useState, useRef, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zodResolver";
import { z } from "zod";
import { useSession } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  GITHUB_ACCOUNT_PATTERN,
  LINKEDIN_ACCOUNT_PATTERN,
  TELEGRAM_ACCOUNT_PATTERN,
  X_ACCOUNT_PATTERN,
} from "@/lib/profile/socialAccountValidation";
import {
  normalizeWalletTag,
  WALLET_TAG_MAX_LENGTH,
  WALLET_TAG_PATTERN,
  WALLET_TAG_VALIDATION_MESSAGE,
} from "@/lib/profile/walletTag";

export const profileSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  username: z.string().optional(),
  bio: z.string().max(250, "Bio must not exceed 250 characters").optional(),
  email: z.email("Invalid email").optional(),
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
  github_account: z
    .union([z.string().regex(GITHUB_ACCOUNT_PATTERN, "Enter a valid GitHub username or github.com URL"), z.literal("")])
    .optional()
    .default(""),
  x_account: z
    .union([z.string().regex(X_ACCOUNT_PATTERN, "Enter a URL like https://x.com/yourhandle"), z.literal("")])
    .optional()
    .default(""),
  linkedin_account: z
    .union([z.string().regex(LINKEDIN_ACCOUNT_PATTERN, "Enter a LinkedIn URL like https://www.linkedin.com/in/username"), z.literal("")])
    .optional()
    .default(""),
  wallet: z.array(
    z.object({
      address: z.string().trim().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address."),
      tag: z
        .string()
        .trim()
        .max(WALLET_TAG_MAX_LENGTH, `Tag must not exceed ${WALLET_TAG_MAX_LENGTH} characters.`)
        .regex(WALLET_TAG_PATTERN, WALLET_TAG_VALIDATION_MESSAGE)
        .optional(),
      signature: z.string().optional(),
      issuedAt: z.string().optional(),
      nonce: z.string().optional(),
    }),
  ).optional().default([]),
  additional_social_accounts: z.array(z.url("Must be a valid URL")).optional().default([]),
  skills: z.array(z.string()).default([]),
  notifications: z.boolean().default(false),
  profile_privacy: z.string().default("public"),
  telegram_account: z
    .union([z.string().regex(TELEGRAM_ACCOUNT_PATTERN, "Enter a valid Telegram username (5-32 chars, starts with a letter)"), z.literal("")])
    .optional()
    .default(""),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

interface WalletFormEntry {
  address: string;
  tag?: string;
  signature?: string;
  issuedAt?: string;
  nonce?: string;
}

function dedupeWallets(wallets: WalletFormEntry[]): WalletFormEntry[] {
  return Object.values(
    wallets.reduce<Record<string, WalletFormEntry>>((acc, item) => {
      const key = item.address.toLowerCase();
      if (!(key in acc)) {
        acc[key] = {
          address: item.address,
          ...(item.tag ? { tag: item.tag } : {}),
          ...(item.signature ? { signature: item.signature } : {}),
          ...(item.issuedAt ? { issuedAt: item.issuedAt } : {}),
          ...(item.nonce ? { nonce: item.nonce } : {}),
        };
      }

      return acc;
    }, {}),
  );
}

function hasWalletAddress(
  value: unknown,
): value is {
  address: string;
  tag?: unknown;
  signature?: unknown;
  issuedAt?: unknown;
  nonce?: unknown;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "address" in value &&
    typeof value.address === "string"
  );
}

function readApiErrorMessage(errorData: unknown, fallback: string): string {
  if (!errorData || typeof errorData !== "object") {
    return fallback;
  }

  const errorRecord = errorData as Record<string, unknown>;
  const baseMessage =
    typeof errorRecord.error === "string" ? errorRecord.error : fallback;

  const details = errorRecord.details;
  if (!details || typeof details !== "object") {
    return baseMessage;
  }

  const detailRecord = details as Record<string, unknown>;
  const fieldErrors = detailRecord.fieldErrors;
  if (fieldErrors && typeof fieldErrors === "object") {
    const formattedFieldErrors = Object.entries(fieldErrors as Record<string, unknown>)
      .flatMap(([field, messages]) => {
        if (!Array.isArray(messages)) {
          return [];
        }

        return messages
          .filter((message): message is string => typeof message === "string")
          .map((message) => `${field}: ${message}`);
      });

    if (formattedFieldErrors.length > 0) {
      return `${baseMessage} ${formattedFieldErrors.join(" | ")}`;
    }
  }

  const formErrors = detailRecord.formErrors;
  if (Array.isArray(formErrors)) {
    const formattedFormErrors = formErrors.filter(
      (message): message is string => typeof message === "string",
    );

    if (formattedFormErrors.length > 0) {
      return `${baseMessage} ${formattedFormErrors.join(" | ")}`;
    }
  }

  return `${baseMessage} ${JSON.stringify(details)}`;
}

export function useProfileForm() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const formData = useRef(new FormData());
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = useRef(true);
  const lastSavedDataRef = useRef<string>("");
  // Ref to gate the auto-save useEffect without adding isAutoSaving to its deps
  // (adding the state directly would cause the effect to re-run after every save,
  //  creating an infinite loop when the form is dirty and save completes)
  const isAutoSavingRef = useRef(false);
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

  const normalizeWallets = (rawWallets: unknown): WalletFormEntry[] => {
    if (!Array.isArray(rawWallets)) return [];

    return rawWallets.flatMap((item) => {
      if (typeof item === "string") {
        const address = item.trim();
        return address ? [{ address }] : [];
      }

      if (hasWalletAddress(item)) {
        const address = item.address.trim();
        if (!address) return [];
        const tag = normalizeWalletTag(item.tag);
        const entry: WalletFormEntry = tag ? { address, tag } : { address };
        if (typeof item.signature === "string" && item.signature) entry.signature = item.signature;
        if (typeof item.issuedAt === "string" && item.issuedAt) entry.issuedAt = item.issuedAt;
        if (typeof item.nonce === "string" && item.nonce) entry.nonce = item.nonce;
        return [entry];
      }

      return [];
    });
  };

  const loadProfile = useCallback(async () => {
    if (!session?.user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/profile/extended/${session.user.id}`);

      if (response.ok) {
        const profile = await response.json();

        let basicProfileData = null;
        if (typeof window !== "undefined") {
          const savedBasicProfile = localStorage.getItem('basicProfileData');
          if (savedBasicProfile) {
            try {
              basicProfileData = JSON.parse(savedBasicProfile);
              localStorage.removeItem('basicProfileData');
            } catch (e) {
              console.error('Error parsing basic profile data:', e);
            }
          }
        }

        const formValues = {
          name: basicProfileData?.name || profile.name || "",
          username: profile.username || "",
          bio: profile.bio || "",
          email: profile.email || session.user.email || "",
          notification_email: profile.notification_email || "",
          image: profile.image || "",
          country: basicProfileData?.country || profile.country || "",
          is_student: basicProfileData?.is_student ?? profile.user_type?.is_student ?? false,
          is_founder: basicProfileData?.is_founder ?? profile.user_type?.is_founder ?? false,
          is_employee: basicProfileData?.is_employee ?? profile.user_type?.is_employee ?? false,
          is_developer: basicProfileData?.is_developer ?? profile.user_type?.is_developer ?? false,
          is_enthusiast: basicProfileData?.is_enthusiast ?? profile.user_type?.is_enthusiast ?? false,
          founder_company_name: basicProfileData?.founder_company_name || profile.user_type?.founder_company_name || "",
          employee_company_name: basicProfileData?.employee_company_name || profile.user_type?.employee_company_name || "",
          employee_role: basicProfileData?.employee_role || profile.user_type?.employee_role || "",
          student_institution: basicProfileData?.student_institution || profile.user_type?.student_institution || "",
          company_name: profile.user_type?.company_name || "",
          role: profile.user_type?.role || "",
          github_account: profile.github_account || "",
          x_account: profile.x_account || "",
          linkedin_account: profile.linkedin_account || "",
          wallet: normalizeWallets(profile.wallet),
          additional_social_accounts: profile.additional_social_accounts || [],
          skills: profile.skills || [],
          notifications: profile.notifications || false,
          profile_privacy: profile.profile_privacy || "public",
          telegram_account: profile.telegram_account || "",
        };

        setGithubConnected(Boolean(profile.githubConnected));
        form.reset(formValues);
        lastSavedDataRef.current = JSON.stringify(formValues);
        setTimeout(() => { isInitialLoadRef.current = false; }, 500);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast({
        title: "Error loading profile",
        description: "Could not load your profile data. Please refresh the page.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setTimeout(() => { isInitialLoadRef.current = false; }, 500);
    }
  }, [session?.user?.id, session?.user?.email, form, toast]);
  
  useEffect(() => {
    const gh = searchParams.get('gh');
    const x = searchParams.get('x');
    if (!gh && !x) return;

    const params = new URLSearchParams(searchParams.toString());
    params.delete('gh');
    params.delete('x');
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

  // Handle file selection for avatar
  const handleFileSelect = (file: File) => {
    // Save file in formData to upload later
    formData.current.set("file", file);
    
    // Create temporary URL for preview
    const imageUrl = URL.createObjectURL(file);
    form.setValue("image", imageUrl, { shouldDirty: true });
  };

  // Auto-save function (silent, no toast notifications)
  const autoSave = useCallback(async (data: ProfileFormValues, skipImageUpload = false) => {
    if (!session?.user?.id || isInitialLoadRef.current) {
      return;
    }

    // Serialize current data for comparison
    const currentDataString = JSON.stringify(data);
    
    // Skip if data hasn't changed (compare serialized data)
    if (currentDataString === lastSavedDataRef.current) {
      return;
    }

    // Skip if form is not dirty (check after data comparison to avoid unnecessary checks)
    if (!formState.isDirty) {
      return;
    }

    // Skip auto-save if required fields are invalid (e.g. name is empty).
    // Uses Zod directly so react-hook-form validation UI is not triggered.
    if (!profileSchema.safeParse(data).success) {
      return;
    }

    setIsAutoSaving(true);
    isAutoSavingRef.current = true;

    try {
      // Only handle image upload if explicitly requested (for manual saves)
      let imageUrl = data.image;

      if (!skipImageUpload) {
        const hasImageChanged = formData.current.has("file");
        if (hasImageChanged) {
          try {
            const imageResponse = await fetch("/api/file", {
              method: "POST",
              body: formData.current,
            });

            if (imageResponse.ok) {
              const imageData = await imageResponse.json();
              imageUrl = imageData.url;
              formData.current = new FormData();
            }
          } catch (imageError) {
            console.error("Image upload error during auto-save:", imageError);
            // Continue with existing image URL if upload fails
          }
        }
      }

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
        github_account: _githubAccount,
        x_account: _xAccount,
        ...restData
      } = data;

      const cleanedWalletEntries = Array.isArray(wallet) ? dedupeWallets(normalizeWallets(wallet)) : [];

      const profileData = {
        ...restData,
        wallet: cleanedWalletEntries.length > 0 ? cleanedWalletEntries : [],
        image: imageUrl,
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
        const errorData: unknown = await response.json().catch(() => null);
        const message = readApiErrorMessage(errorData, "Failed to auto-save profile");
        console.error("[Profile auto-save] invalid response", {
          status: response.status,
          statusText: response.statusText,
          errorData,
          payload: profileData,
        });
        throw new Error(message);
      }
      
      const updatedProfile = await response.json();
      
      // Update last saved data reference with the data we just sent
      // This ensures we track what was actually saved without resetting the form
      lastSavedDataRef.current = currentDataString;
      
      // DO NOT reset the form during auto-save - this would cause the form to "reload"
      // and lose the user's current edits (like checkboxes being unchecked)
      // The form will remain "dirty" but that's okay - it will auto-save again if needed
    } catch (error) {
      console.error("Error auto-saving profile:", error);
      // Silently fail - don't show toast for auto-save errors
    } finally {
      setIsAutoSaving(false);
      isAutoSavingRef.current = false;
    }
  }, [session?.user?.id, session?.user?.email, form, formState.isDirty]);

  // Debounced auto-save effect - watches form values and triggers save after user stops editing
  useEffect(() => {
    // Skip auto-save during initial load
    // Note: isAutoSaving is intentionally read via ref (not state) so this effect does
    // not re-run each time a save completes, which would create an infinite save loop.
    if (isInitialLoadRef.current || !formState.isDirty || isLoading || isAutoSavingRef.current) {
      return;
    }

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout for auto-save (1.5 seconds after user stops typing)
    autoSaveTimeoutRef.current = setTimeout(() => {
      // Get current values at the time of save (not from watchedValues to avoid stale closures)
      // This ensures we get the latest values without causing re-renders
      const currentValues = form.getValues();
      // Run auto-save asynchronously without blocking
      autoSave(currentValues, true).catch((error) => {
        // Silently handle errors - don't interrupt user
        console.error("Auto-save error:", error);
      });
    }, 1500);

    // Cleanup timeout on unmount or when values change again
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  // isAutoSaving is deliberately excluded from deps — see isAutoSavingRef comment above.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedValues, formState.isDirty, isLoading, autoSave, form]);

  // Handle form submission
  const onSubmit = async (data: ProfileFormValues) => {
    if (!session?.user?.id) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to update your profile",
        variant: "destructive",
      });
      return;
    }

    // Only format validations - no required fields
    let hasErrors = false;

    // Validate wallet format if provided (validate each wallet in the array)
    if (data.wallet && Array.isArray(data.wallet) && data.wallet.length > 0) {
      const invalidWallets = normalizeWallets(data.wallet).filter(
        (wallet) => !/^0x[a-fA-F0-9]{40}$/.test(wallet.address),
      );
      
      if (invalidWallets.length > 0) {
        form.setError("wallet", {
          type: "manual",
          message: `Invalid Ethereum address format: ${invalidWallets.length} wallet(s) are invalid (must be 0x + 40 hex characters)`,
        });
        hasErrors = true;
      }
    }

    if (hasErrors) {
      return;
    }

    setIsSaving(true);

    try {
      // Check if there's a new image to upload
      const hasImageChanged = formData.current.has("file");
      let imageUrl = data.image;

      // If there's a new image, upload it first
      if (hasImageChanged) {
        try {
          const imageResponse = await fetch("/api/file", {
            method: "POST",
            body: formData.current,
          });

          if (!imageResponse.ok) {
            throw new Error("Error uploading image");
          }

          const imageData = await imageResponse.json();
          imageUrl = imageData.url;
          
          // Clear formData after upload
          formData.current = new FormData();
        } catch (imageError) {
          console.error("Image upload error:", imageError);
          toast({
            title: "Warning",
            description: "Profile updated but image upload failed. Please try uploading the image again.",
            variant: "destructive",
          });
        }
      }

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
        github_account: _githubAccount,
        x_account: _xAccount,
        ...restData
      } = data;

      const cleanedWalletArray = dedupeWallets(normalizeWallets(wallet));

      const profileData = {
        ...restData,
        wallet: cleanedWalletArray.length > 0 ? cleanedWalletArray : [],
        image: imageUrl, // Use uploaded image or existing one
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

      console.log("Saving profile data:", profileData);
      
      const response = await fetch(`/api/profile/extended/${session.user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      });
      
      if (!response.ok) {
        const errorData: unknown = await response.json().catch(() => null);
        const message = readApiErrorMessage(errorData, "Failed to update profile");
        console.error("[Profile save] invalid response", {
          status: response.status,
          statusText: response.statusText,
          errorData,
          payload: profileData,
        });
        throw new Error(message);
      }
      
      const updatedProfile = await response.json();
      console.log('Profile updated successfully:', updatedProfile);
      
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully.",
      });
      
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
        wallet: normalizeWallets(updatedProfile.wallet),
        additional_social_accounts: updatedProfile.additional_social_accounts || [],
        skills: updatedProfile.skills || [],
        notifications: updatedProfile.notifications || false,
        profile_privacy: updatedProfile.profile_privacy || "public",
        telegram_account: updatedProfile.telegram_account || "",
      };

      form.reset(newFormData);
      
      // Update last saved data reference
      lastSavedDataRef.current = JSON.stringify(newFormData);
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Error saving profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

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
  const handleAddWallet = (address: string, tag?: string, signature?: string, issuedAt?: string, nonce?: string) => {
    const currentWallets = normalizeWallets(watchedValues.wallet);
    const trimmedAddress = address?.trim() ?? "";
    if (trimmedAddress === "" || !/^0x[a-fA-F0-9]{40}$/.test(trimmedAddress)) return;

    const normalizedTag = normalizeWalletTag(tag);
    const isDuplicate = currentWallets.some((entry) =>
      entry.address.trim().toLowerCase() === trimmedAddress.toLowerCase(),
    );

    if (!isDuplicate) {
      setValue(
        "wallet",
        [
          ...currentWallets,
          {
            address: trimmedAddress,
            ...(normalizedTag ? { tag: normalizedTag } : {}),
            ...(signature ? { signature } : {}),
            ...(issuedAt ? { issuedAt } : {}),
            ...(nonce ? { nonce } : {}),
          },
        ],
        { shouldDirty: true },
      );
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
    isSaving,
    isAutoSaving,
    githubConnected,
    setGithubConnected,
    handleFileSelect,
    handleAddSkill,
    handleRemoveSkill,
    handleAddSocial,
    handleRemoveSocial,
    handleAddWallet,
    handleRemoveWallet,
    onSubmit: form.handleSubmit(onSubmit),
  };
}
