import { useState, useRef, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSession } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";

// Zod validation schema - no required fields, only format validations
export const profileSchema = z.object({
  name: z.string().optional(),
  username: z.string().optional(),
  bio: z.string().max(250, "Bio must not exceed 250 characters").optional(),
  email: z.email("Invalid email").optional(), // Email from session, optional
  image: z.string().optional(),
  country: z.string().optional(),
  // user_type as JSON object - all optional
  is_student: z.boolean().optional().default(false),
  is_founder: z.boolean().optional().default(false),
  is_employee: z.boolean().optional().default(false),
  is_developer: z.boolean().optional().default(false),
  is_enthusiast: z.boolean().optional().default(false),
  // Founder fields
  founder_company_name: z.string().optional(),
  // Employee fields
  employee_company_name: z.string().optional(),
  employee_role: z.string().optional(),
  // Student fields
  student_institution: z.string().optional(),
  // Legacy fields (for backward compatibility)
  company_name: z.string().optional(),
  role: z.string().optional(),
  github: z.string().optional(),
  wallet: z.array(z.string()).optional().default([]),
  socials: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  notifications: z.boolean().default(false),
  profile_privacy: z.string().default("public"),
  telegram_user: z.string().optional(),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

export function useProfileForm() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const formData = useRef(new FormData());
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = useRef(true);
  const lastSavedDataRef = useRef<string>("");

  // Initialize form with react-hook-form and Zod
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
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
      github: "",
      wallet: [],
      socials: [],
      skills: [],
      notifications: false,
      profile_privacy: "public",
      telegram_user: "",
    },
  });

  const { watch, setValue, formState } = form;
  const watchedValues = watch();

  // Load profile data on component mount
  useEffect(() => {
    async function loadProfile() {
      if (!session?.user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/profile/extended/${session.user.id}`);
        
        if (response.ok) {
          const profile = await response.json();
          
          // Check if there's basic profile data from the modal in localStorage
          let basicProfileData = null;
          if (typeof window !== "undefined") {
            const savedBasicProfile = localStorage.getItem('basicProfileData');
            if (savedBasicProfile) {
              try {
                basicProfileData = JSON.parse(savedBasicProfile);
                // Clear it after reading
                localStorage.removeItem('basicProfileData');
              } catch (e) {
                console.error('Error parsing basic profile data:', e);
              }
            }
          }

          // Decompose user_type from JSON to individual form fields
          // Merge with basic profile data if available
          const formData = {
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
            github: profile.github || "",
            wallet: Array.isArray(profile.wallet) ? profile.wallet : (profile.wallet ? [profile.wallet] : []),
            socials: profile.socials || [],
            skills: profile.skills || [],
            notifications: profile.notifications || false,
            profile_privacy: profile.profile_privacy || "public",
            telegram_user: profile.telegram_user || "",
          };

          form.reset(formData);
          
          // Update last saved data reference
          lastSavedDataRef.current = JSON.stringify(formData);
          
          // Mark initial load as complete after a short delay
          setTimeout(() => {
            isInitialLoadRef.current = false;
          }, 500);
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
        // Mark initial load as complete even on error
        setTimeout(() => {
          isInitialLoadRef.current = false;
        }, 500);
      }
    }

    loadProfile();
  }, [session?.user?.id, session?.user?.email, form, toast]);

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

    setIsAutoSaving(true);

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
        ...restData
      } = data;

      // Clean wallet array: remove empty strings and duplicates
      const cleanedWallets = Array.isArray(wallet)
        ? [...new Set(wallet.filter(w => w && w.trim() !== ""))]
        : [];

      const profileData = {
        ...restData,
        wallet: cleanedWallets.length > 0 ? cleanedWallets : [],
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
        throw new Error('Failed to auto-save profile');
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
    }
  }, [session?.user?.id, session?.user?.email, form, formState.isDirty]);

  // Debounced auto-save effect - watches form values and triggers save after user stops editing
  useEffect(() => {
    // Skip auto-save during initial load
    if (isInitialLoadRef.current || !formState.isDirty || isLoading || isAutoSaving) {
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
  }, [watchedValues, formState.isDirty, isLoading, isAutoSaving, autoSave, form]);

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
      const invalidWallets = data.wallet.filter(
        (wallet) => wallet && wallet.trim() !== "" && !/^0x[a-fA-F0-9]{40}$/.test(wallet.trim())
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
        ...restData
      } = data;

      // Clean wallet array: remove empty strings and duplicates
      const cleanedWallets = Array.isArray(wallet)
        ? [...new Set(wallet.filter(w => w && w.trim() !== ""))]
        : [];

      const profileData = {
        ...restData,
        wallet: cleanedWallets.length > 0 ? cleanedWallets : [],
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
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
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
        is_enthusiast: updatedProfile.user_type?.is_enthusiast || false,
        founder_company_name: updatedProfile.user_type?.founder_company_name || "",
        employee_company_name: updatedProfile.user_type?.employee_company_name || "",
        employee_role: updatedProfile.user_type?.employee_role || "",
        student_institution: updatedProfile.user_type?.student_institution || "",
        company_name: updatedProfile.user_type?.company_name || "",
        role: updatedProfile.user_type?.role || "",
        github: updatedProfile.github || "",
        wallet: Array.isArray(updatedProfile.wallet) ? updatedProfile.wallet : (updatedProfile.wallet ? [updatedProfile.wallet] : []),
        socials: updatedProfile.socials || [],
        skills: updatedProfile.skills || [],
        notifications: updatedProfile.notifications || false,
        profile_privacy: updatedProfile.profile_privacy || "public",
        telegram_user: updatedProfile.telegram_user || "",
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
    const currentSocials = watchedValues.socials || [];
    setValue("socials", [...currentSocials, ""], { shouldDirty: true });
  };

  const handleRemoveSocial = (index: number) => {
    const currentSocials = watchedValues.socials || [];
    setValue("socials", currentSocials.filter((_, i) => i !== index), { shouldDirty: true });
  };

  // Wallet handlers
  const handleAddWallet = (address: string) => {
    const currentWallets = watchedValues.wallet || [];
    // Validar formato antes de agregar
    if (address && address.trim() !== "" && /^0x[a-fA-F0-9]{40}$/.test(address.trim())) {
      const trimmedAddress = address.trim();
      // Evitar duplicados
      if (!currentWallets.includes(trimmedAddress)) {
        setValue("wallet", [...currentWallets, trimmedAddress], { shouldDirty: true });
      }
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

