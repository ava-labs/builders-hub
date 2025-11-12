"use client";
import {
  Check,
  Crown,
  X,
  Upload,
  Plus,
  Minus,
  AlertCircle,
  Loader2,
} from "lucide-react";
import React, { use, useEffect, useState } from "react";
import Image from "next/image";
import Avalance3d from "@/public/images/avalance3d.svg";
import CustomInput from "@/components/ambassador-dao/input";
import CustomSelect from "@/components/ambassador-dao/select";
import {
  useCheckCompanyUsernameAvailabilityMutation,
  useCheckUsernameAvailabilityMutation,
  useFetchAllSkills,
  useFileUploadMutation,
  useSelectRoleMutation,
  useUpdateSponsorProfileMutation,
  useUpdateTalentProfileMutation,
} from "@/services/ambassador-dao/requests/onboard";
import { usePathname, useRouter } from "next/navigation";
import CustomButton from "@/components/ambassador-dao/custom-button";
import { useForm } from "react-hook-form";
import {
  IUpdateSponsorProfileBody,
  IUpdateTalentProfileBody,
} from "@/services/ambassador-dao/interfaces/onbaord";
import toast from "react-hot-toast";
import { useFetchUserDataQuery } from "@/services/ambassador-dao/requests/auth";
import { countries } from "@/services/ambassador-dao/data/locations";
import { useUpdateWalletAddress } from "@/services/ambassador-dao/requests/users";
import Loader from "@/components/ambassador-dao/ui/Loader";
import FileUploader from "@/components/ambassador-dao/ui/FileUploader";
import { useSession } from "next-auth/react";
import axios from "axios";
import { Switch } from "@/components/ui/switch";
import { useTalentProfile } from "@/hooks/useTalentProfile";

const userTypes = [
  {
    name: "Talent",
    description:
      "Create a profile to start submitting, and get notified on new work opportunities",
    perks: [
      "Contribute to top Solana projects",
      "Build your web3 resume",
      "Automated yield farming solutions",
    ],
  },
  {
    name: "Sponsor",
    description:
      "List a bounty or freelance gig for your project and find your next contributor",
    perks: [
      "Get in front of 10,000 weekly visitors",
      "20+ templates to choose from",
      "100% free",
    ],
  },
];

const AmbasssadorDaoOnboardPage = () => {
  const { data: userData, isLoading } = useFetchUserDataQuery();
  const [userType, setUserType] = useState<"TALENT" | "SPONSOR">("TALENT");
  const [selectionStep, setShowSelectionStep] = useState<
    "account_option" | "account_form"
  >(userData?.role ? "account_form" : "account_option");

  useEffect(() => {
    if (userData?.role) {
      setShowSelectionStep("account_form");
      setUserType(userData.role as "TALENT" | "SPONSOR");
    }
  }, [userData]);

  const { mutate: selectRole, isPending: isSelectingRole } =
    useSelectRoleMutation();

  const handleContinue = (type: "TALENT" | "SPONSOR") => {
    setUserType(type);
    selectRole(type, {
      onSuccess: () => {
        setShowSelectionStep("account_form");
      },
    });
  };

  const handleClose = () => {
    setShowSelectionStep("account_option");
  };

  if (isLoading) {
    return <Loader />;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-8 md:p-16 lg:p-24">
      {selectionStep === "account_option" && (
        <div className="w-full flex flex-col md:flex-row gap-8 md:gap-6">
          {userTypes.map((type, idx) => (
            <div
              key={idx}
              className={`rounded-xl border border-[var(--default-border-color)] bg-[var(--default-background-color)] p-6 flex-1 cursor-pointer
                  ${
                    userType === type.name.toUpperCase()
                      ? "border-[#FB2C36]"
                      : ""
                  }
                `}
              onClick={() => setUserType(type.name.toUpperCase() as any)}
            >
              <div className="flex items-center gap-6">
                <div className="w-10 md:w-14 h-10 md:h-14 shrink-0 flex items-center justify-center bg-[#FB2C36] rounded-full p-2">
                  <Crown color="white" size={28} />
                </div>
                <div className="text-[var(--primary-text-color)]">
                  <p className="font-medium text-2xl md:text-3xl">
                    Continue as <span className="capitalize">{type.name}</span>
                  </p>
                  <p>{type.description}</p>
                </div>
              </div>

              <hr className="my-6 border-[var(--default-border-color)]" />

              <div className="bg-zinc-200 dark:bg-[#000] rounded-md h-36 md:h-44 relative overflow-hidden">
                <Image
                  src={Avalance3d}
                  objectFit="contain"
                  alt="avalance icon"
                  className="absolute object-cover right-0 h-full"
                />
              </div>

              <hr className="my-6 border-[var(--default-border-color)]" />

              <div className="flex flex-col space-y-2">
                {type.perks.map((perk, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 text-[var(--primary-text-color)]"
                  >
                    <Check color="var(--primary-text-color)" size={16} />
                    <p className="text-sm">{perk}</p>
                  </div>
                ))}
              </div>

              <hr className="my-6 border-[var(--default-border-color)]" />

              <div className="flex justify-center">
                <CustomButton
                  variant="danger"
                  isFullWidth={false}
                  isLoading={
                    isSelectingRole && userType === type.name.toUpperCase()
                  }
                  onClick={() => handleContinue(type.name.toUpperCase() as any)}
                  className="px-6 h-10 text-sm font-medium"
                >
                  Continue as {type.name}
                </CustomButton>
              </div>
            </div>
          ))}
        </div>
      )}
      {selectionStep === "account_form" && (
        <div className="bg-[var(--default-background-color)] rounded-xl border border-[var(--default-border-color)] p-6 py-10">
          {userType === ("USER" as "TALENT") && <TalentForm />}
          {userType === ("AMBASSADOR" as "TALENT") && <TalentForm />}
          {userType === "SPONSOR" && <SponsorForm />}
        </div>
      )}
    </div>
  );
};

export default AmbasssadorDaoOnboardPage;

const TalentForm = () => {
  const router = useRouter();
  const { data: userData } = useFetchUserDataQuery();
  const { data: session } = useSession();
  const [isDataFetched, setIsDataFetched] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setValue,
    watch,
    reset,
    getValues,
  } = useForm<IUpdateTalentProfileBody>({
    defaultValues: {
      first_name: "",
      last_name: "",
      username: "",
      location: "",
      job_title: "",
      years_of_experience: "",
      bio: "",
      profile_image: "",
      telegram_user: "",
      profile_privacy: "public",
      notifications: false,
    },
  });
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [socialLinks, setSocialLinks] = useState<string[]>([""]);
  const [currentSocialLink, setCurrentSocialLink] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<
    "checking" | "available" | "unavailable" | null
  >(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [stage, setStage] = useState(1);

  const pathname = usePathname();

  const isEditProfilePage = pathname === "/ambassador-dao/edit-profile";
  const isOnboardPage = pathname === "/ambassador-dao/onboard";

  const username = watch("username");
  const location = watch("location");
  const profile_image = watch("profile_image");

  const { mutate: updateTalentProfile, isPending: isUpdatingProfile } =
    useUpdateTalentProfileMutation();
  const { mutate: checkUsername } = useCheckUsernameAvailabilityMutation();
  const { data: skills } = useFetchAllSkills();

  // Use custom hook for talent profile logic
  const {
    localProfileData,
    previewImage,
    isUploadingProfileImage,
    profileImageName,
    profileImageSize,
    isUploading,
    handleProfileImageUpload,
    removeFile,
    saveToLocalProfile,
    onSkip,
  } = useTalentProfile({
    setValue,
    watch,
    getValues,
    setIsDataFetched,
  });

  useEffect(() => {
    if (userData) {
      if (userData.first_name && userData.wallet_address && isOnboardPage) {
        router.push("/ambassador-dao");
      }

      reset({
        first_name: userData.first_name || "",
        last_name: userData.last_name || "",
        username: userData.username || "",
        location: userData.location || "",
        job_title: userData.job_title || "",
        social_links: userData.social_links || [],
        years_of_experience: userData.years_of_experience || "",
        bio: localProfileData?.bio || "",
        profile_image: localProfileData?.image || userData.profile_image || "",
        telegram_user: localProfileData?.telegram_user || "",
        profile_privacy: localProfileData?.profile_privacy || "public",
        notifications: localProfileData?.notifications ?? false,
      });

      if (userData.skills && userData.skills.length > 0) {
        setSelectedSkills(
          userData.skills.map((skill: { id: string }) => skill.id)
        );
      }

      if (userData.social_links && userData.social_links.length > 0) {
        setSocialLinks(userData.social_links);
      }
      if (
        !isEditProfilePage &&
        userData.first_name &&
        userData.location &&
        userData.skills &&
        userData.skills.length > 0
      ) {
        setStage(2);
      } else {
        setStage(1);
      }

      setIsDataFetched(true);
    }
  }, [
    userData,
    localProfileData,
    router,
    isEditProfilePage,
    isOnboardPage,
    reset,
  ]);

  useEffect(() => {
    if (username && username.length >= 3 && username.length <= 30) {
      if (userData?.username === username) {
        setUsernameStatus("available");
        return;
      }

      setUsernameStatus("checking");
      const timer = setTimeout(() => {
        checkUsername(username, {
          onSuccess: (data) => {
            if (data.is_available) {
              setUsernameStatus("available");
            } else {
              setUsernameStatus("unavailable");
            }
          },
          onError: (error: any) => {
            setUsernameStatus(null);
            setUsernameError(error?.response?.data?.message);
          },
        });
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setUsernameStatus(null);
    }
  }, [username, checkUsername, userData?.username]);

  const addSkill = (skill: string) => {
    if (selectedSkills.length >= 5) {
      toast.remove();
      toast.error("You can only select up to 5 skills");
      return;
    }
    if (!selectedSkills.includes(skill) && skill) {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  const removeSkill = (skill: string) => {
    const updated = selectedSkills.filter((s) => s !== skill);
    setSelectedSkills(updated);
    setValue("skill_ids", updated);
  };

  const addSocialLink = () => {
    if (currentSocialLink && !socialLinks.includes(currentSocialLink)) {
      const updatedLinks = [...socialLinks, currentSocialLink];
      setSocialLinks(updatedLinks);
      setCurrentSocialLink("");
    } else {
      toast.error("Social link already exists");
    }
  };

  const removeSocialLink = (link: string) => {
    const updated = socialLinks.filter((l) => l !== link);
    setSocialLinks(updated);
    setValue("social_links", updated);
  };

  const handleSkip = () => {
    onSkip();
  };

  const onSubmit = (data: any) => {
    // Filter out empty social links
    const validSocialLinks = socialLinks.filter(link => link.trim() !== '');
    
    // Set default profile image URL if no image is provided
    const submitData = {
      ...data,
      profile_image: data.profile_image && data.profile_image !== '' 
      ? data.profile_image  
      : 'https://ava.com/profile.png', 
      skill_ids: selectedSkills,
      social_links: validSocialLinks,
      years_of_experience: +data.years_of_experience,
    };
    
    updateTalentProfile(submitData,
      {
        onSuccess: async () => {
          // Save to local User table
          try {
            await saveToLocalProfile(data, socialLinks);
          } catch (error) {
            // No bloqueamos el flujo
          }

          if (isEditProfilePage) {
            return;
          } else {
            setStage(2);
          }
        },
      }
    );
  };

  const onSubmitWallet = (data: any) => {
    updateTalentWallet(
      {
        wallet_address: data.wallet_address,
      },
      {
        onSuccess: async () => {
          // Update local User table with final data
          try {
            const formData = watch();
            await saveToLocalProfile(formData, socialLinks);
            console.log("✅ Local profile updated with wallet");
          } catch (error) {
            console.error("❌ Error updating local profile:", error);
          }

          // Check for stored redirect URL and navigate there, otherwise go to ambassador-dao
          const redirectUrl = typeof window !== "undefined" 
            ? localStorage.getItem("redirectAfterProfile") 
            : null;
          
          if (redirectUrl) {
            localStorage.removeItem("redirectAfterProfile");
            router.push(redirectUrl);
          } else {
            router.push("/ambassador-dao");
          }
        },
      }
    );
  };

  const { mutateAsync: updateTalentWallet, isPending: isConnectingWallet } =
    useUpdateWalletAddress();

  if (!isDataFetched) {
    return (
      <div className="flex justify-center items-center h-60">
        <Loader2 className="animate-spin" size={30} color="#FB2C36" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center">
        <h2 className="text-[var(--primary-text-color)] text-xl md:text-2xl font-medium">
          {isEditProfilePage
            ? stage === 1
              ? "Edit Your Profile"
              : "Update Wallet Address"
            : stage === 1
            ? "Finish Your Profile"
            : "Add a wallet address"}
        </h2>
      </div>
      <p className="text-[var(--secondary-text-color)] text-sm">
        {isEditProfilePage
          ? "Update your profile information and wallet details."
          : "It takes less than a minute to start earning in global standards."}
      </p>

      <hr className="border-[var(--default-border-color)] my-6" />

      {stage === 1 && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="text-[var(--primary-text-color)] text-sm mt-6 md:mt-10 flex flex-col gap-4"
        >
          {" "}
          <FileUploader
            fileSize={profileImageSize}
            singleFile={true}
            removeFile={removeFile}
            previewUrl={previewImage || profile_image}
            fileName={profileImageName}
            handleFileUpload={handleProfileImageUpload}
            isUploading={isUploadingProfileImage && isUploading}
            accept=".png,.jpg,.jpeg,.svg"
            inputId="talentProfileImage"
            label="Upload Profile Image or Avatar"
            required={false}
            recommendedSize="Add the image here. Recommended size: 512 x 512px (square format)"
            allowedFileTypes="JPG, PNG, SVG"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CustomInput
              id="firstName"
              label="First Name"
              placeholder="First Name"
              error={errors.first_name}
              {...register("first_name")}
            />
            <CustomInput
              id="lastName"
              label="Last Name"
              placeholder="Last Name"
              error={errors.last_name}
              {...register("last_name")}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
            <CustomInput
              id="bio"
              label="Bio"
              placeholder="Tell others about yourself in a few words"
              error={errors.bio}
              {...register("bio")}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CustomInput
              id="job_title"
              label="Job Title"
              placeholder="Job Title"
              error={errors.job_title}
              {...register("job_title")}
            />
            <CustomInput
              id="years_of_experience"
              label="Years of experience"
              type="number"
              placeholder="3"
              error={errors.years_of_experience}
              {...register("years_of_experience")}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative">
              <CustomInput
                id="userName"
                label="User Name"
                placeholder="User Name"
                error={errors.username}
                {...register("username")}
                className="relative"
                icon={
                  <>
                    {" "}
                    {usernameStatus === "checking" && (
                      <Loader2
                        className="absolute right-2 animate-spin"
                        size={20}
                        color="currentColor"
                      />
                    )}
                    {usernameStatus === "available" && (
                      <Check
                        className="absolute right-2"
                        size={20}
                        color="#10B981"
                      />
                    )}
                    {usernameStatus === "unavailable" && (
                      <AlertCircle
                        className="absolute right-2"
                        size={20}
                        color="#FB2C36"
                      />
                    )}
                  </>
                }
              />
              {usernameStatus === "unavailable" && (
                <p className="text-red-500 text-xs mt-1">
                  Username is already taken
                </p>
              )}

              {usernameError && (
                <p className="text-red-500 text-xs mt-1">{usernameError}</p>
              )}
            </div>

            <CustomSelect
              id="location"
              label="Location"
              {...register("location")}
            >
              <option value="">Select location</option>
              {countries.map((country, idx) => (
                <option value={country.name} key={idx} className="capitalize">
                  {country.name}
                </option>
              ))}
            </CustomSelect>
          </div>
          <div>
            <div className="my-2">
              <p className="block text-sm mb-2">
                Your skills
              </p>
            </div>
            <div className="w-full h-12 flex flex-wrap gap-2 px-2 py-2 rounded-md bg-[var(--default-background-color)] border border-[var(--default-border-color)] text-[var(--primary-text-color)] focus:outline-none focus:border-[#FB2C36] overflow-x-auto">
              {selectedSkills &&
                !!selectedSkills.length &&
                selectedSkills.map((badge, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 bg-gray-200 dark:bg-[#fff] text-[#18181B] rounded-full px-2 text-sm cursor-pointer capitalize"
                    onClick={() => removeSkill(badge)}
                  >
                    {skills?.find((skill) => skill.id === badge)?.name}
                    <X size={16} color="currentColor" />
                  </div>
                ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {skills &&
                !!skills.length &&
                skills
                  .filter((skill) => !selectedSkills.includes(skill.id))
                  .map((badge, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-[var(--default-background-color)] border border-[var(--default-border-color)] rounded-full px-3 py-1 text-sm cursor-pointer capitalize"
                      onClick={() => addSkill(badge.id)}
                    >
                      {badge.name}
                      <Plus size={16} color="#A1A1AA" />
                    </div>
                  ))}

              {!skills?.length && (
                <>
                  <p className="text-center mt-1 text-sm font-thin">
                    No skills available
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {socialLinks.map((link, idx) => (
              <div key={idx}>
                <CustomInput
                  id={`social-${idx}`}
                  label={`Social Link ${idx + 1}`}
                  placeholder="Enter social link"
                  type="url"
                  value={link}
                  onChange={(e) => {
                    const updatedLinks = [...socialLinks];
                    updatedLinks[idx] = e.target.value;
                    setSocialLinks(updatedLinks);
                  }}
                />
                {socialLinks.length > 1 && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="flex items-center text-sm text-[var(--secondary-text-color)] font-medium gap-2 mt-1"
                      onClick={() => {
                        const updatedLinks = socialLinks.filter(
                          (_, i) => i !== idx
                        );
                        setSocialLinks(updatedLinks);
                      }}
                    >
                      <Minus size={14} color="var(--secondary-text-color)" />{" "}
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
            <div className="flex justify-end">
              <button
                type="button"
                className="flex items-center text-sm text-[var(--secondary-text-color)] font-medium gap-2 mt-2"
                onClick={() => setSocialLinks([...socialLinks, ""])}
              >
                <Plus size={14} color="var(--secondary-text-color)" /> Add
                Social Link
              </button>
            </div>
          </div>

          {/* Telegram User */}
          <div>
            <label className="block text-sm mb-2">
              Telegram User
            </label>
            <CustomInput
              id="telegram_user"
              placeholder="Enter your telegram user without the @"
              {...register("telegram_user")}
            />
            <p className="text-xs text-[var(--secondary-text-color)] mt-1">
              We can be in touch through telegram.
            </p>
          </div>

          {/* Profile Privacy */}
          <div>
            <label className="block text-sm mb-2">
              Profile Privacy (Coming soon)
            </label>
            <CustomSelect
              id="profile_privacy"
              {...register("profile_privacy")}
            >
              <option value="public">Public (Visible to everyone)</option>
              <option value="private">Private</option>
              <option value="community">Community-only</option>
            </CustomSelect>
            <p className="text-xs text-[var(--secondary-text-color)] mt-1">
              Choose who can see your profile
            </p>
          </div>

          {/* Email Notifications */}
          <div>
            <p className="text-sm font-medium mb-2">Email Notifications</p>
            <div className="flex items-center justify-between p-4 border border-[var(--default-border-color)] rounded">
              <div className="space-y-1 flex-1 pr-4">
                <p className="text-sm text-[var(--secondary-text-color)] italic">
                  I wish to stay informed about Avalanche news and events and
                  agree to receive newsletters and other promotional materials
                  at the email address I provided. {"\n"}I know that I
                  may opt-out at any time. I have read and agree to the{" "}
                  <a
                    href="https://www.avax.network/privacy-policy"
                    className="text-[#FB2C36] hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Avalanche Privacy Policy
                  </a>
                  .
                </p>
              </div>
              <Switch
                checked={watch("notifications")}
                onCheckedChange={(checked) => setValue("notifications", checked, { shouldDirty: true })}
              />
            </div>
          </div>

          <hr className="border-[var(--default-border-color)] my-6" />
          <div className="flex justify-start items-center gap-4">
            <CustomButton
              isLoading={isUpdatingProfile}
              variant="danger"
              type="submit"
              isFullWidth={false}
              className="px-6"
              disabled={isUpdatingProfile}
            >
              {isEditProfilePage ? "Submit Updated Details" : "Create Profile"}
            </CustomButton>

            {!isEditProfilePage && (
              <CustomButton
                variant="outlined"
                type="button"
                isFullWidth={false}
                className="px-6"
                onClick={handleSkip}
                disabled={isUpdatingProfile}
              >
                Skip
              </CustomButton>
            )}
          </div>
        </form>
      )}

      {stage === 2 && (
        <form
          onSubmit={handleSubmit(onSubmitWallet)}
          className="text-[var(--primary-text-color)] text-sm mt-6 md:mt-10 flex flex-col gap-4"
        >
          <CustomInput
            id="wallet_address"
            label="Enter Wallet Address"
            placeholder="Enter Wallet Address"
            defaultValue={userData?.wallet_address || ""}
            {...register("wallet_address")}
          />

          <hr className="border-[var(--default-border-color)] my-6" />
          <div className="flex justify-between">
            <CustomButton
              isLoading={isConnectingWallet}
              variant="danger"
              type="submit"
              isFullWidth={false}
              className="px-6"
            >
              {isEditProfilePage ? "Update Wallet" : "Connect Wallet"}
            </CustomButton>

            {isEditProfilePage && (
              <CustomButton
                variant="outlined"
                type="button"
                isFullWidth={false}
                className="px-6"
                onClick={() => setStage(1)}
              >
                Back to Profile
              </CustomButton>
            )}
          </div>
        </form>
      )}
    </div>
  );
};

const SponsorForm = () => {
  const [previewLogo, setPreviewLogo] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isUploadingProfileImage, setIsUploadingProfileImage] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [localProfileData, setLocalProfileData] = useState<any>(null);

  const { data: userData } = useFetchUserDataQuery();
  const { data: session } = useSession();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setValue,
    getValues,
    watch,
  } = useForm<IUpdateSponsorProfileBody>({
    defaultValues: {
      first_name: userData?.first_name || "",
      last_name: userData?.last_name || "",
      username: userData?.username || "",
      location: userData?.location || "",
      profile_image: userData?.profile_image || "",
      logo: userData?.logo || "",
      company_user_name: userData?.company_user_name || "",
    },
  });

  const [usernameStatus, setUsernameStatus] = useState<
    "checking" | "available" | "unavailable" | null
  >(null);
  const [companyUsernameStatus, setCompanyUsernameStatus] = useState<
    "checking" | "available" | "unavailable" | null
  >(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [companyUsernameError, setCompanyUsernameError] = useState<
    string | null
  >(null);
  const [profileImageName, setProfileImageName] = useState<string>("");
  const [companyLogoName, setCompanyLogoName] = useState<string>("");
  const [logoSize, setLogoSize] = useState<number>();
  const [profileImageSize, setProfileImageSize] = useState<number>();

  const username = watch("username");
  const company_username = watch("company_user_name");
  const profile_image = watch("profile_image");
  const logo = watch("logo");

  const { mutateAsync: updateSponsorProfile, isPending: isUpdatingProfile } =
    useUpdateSponsorProfileMutation();
  const { mutateAsync: checkUsername, isPending: isCheckingUsername } =
    useCheckUsernameAvailabilityMutation();
  const {
    mutateAsync: checkCompanyUsername,
    isPending: isCheckingCompanyUsername,
  } = useCheckCompanyUsernameAvailabilityMutation();
  const { mutateAsync: uploadFile, isPending: isUploading } =
    useFileUploadMutation("image");

  const pathname = usePathname();
  const isEditProfilePage = pathname === "/ambassador-dao/edit-profile";

  // Fetch local profile data to get bio
  useEffect(() => {
    const fetchLocalProfile = async () => {
      if (session?.user?.id) {
        try {
          const response = await axios.get(`/api/profile/${session.user.id}`);
          setLocalProfileData(response.data);
        } catch (error) {
          console.error("Error fetching local profile:", error);
        }
      }
    };

    fetchLocalProfile();
  }, [session?.user?.id]);

  // Update short_bio from local profile when available
  useEffect(() => {
    if (localProfileData?.bio && isEditProfilePage) {
      setValue("short_bio", localProfileData.bio);
    }
  }, [localProfileData, isEditProfilePage, setValue]);

  useEffect(() => {
    if (username && username.length >= 3 && username.length <= 30) {
      setUsernameStatus("checking");
      const timer = setTimeout(() => {
        checkUsername(username, {
          onSuccess: (data) => {
            if (data.is_available) {
              setUsernameStatus("available");
            } else {
              setUsernameStatus("unavailable");
            }
          },
          onError: (error: any) => {
            setUsernameStatus(null);
            setUsernameError(error?.response?.data?.message);
          },
        });
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setUsernameStatus(null);
    }
  }, [username, checkUsername]);

  useEffect(() => {
    if (company_username && company_username.length >= 3 && company_username.length <= 30) {
      setCompanyUsernameStatus("checking");
      const timer = setTimeout(() => {
        checkCompanyUsername(company_username, {
          onSuccess: (data) => {
            if (data.is_available) {
              setCompanyUsernameStatus("available");
            } else {
              setCompanyUsernameStatus("unavailable");
            }
          },
          onError: (error: any) => {
            setCompanyUsernameStatus(null);
            setCompanyUsernameError(error?.response?.data?.message);
          },
        });
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setCompanyUsernameStatus(null);
    }
  }, [company_username, checkCompanyUsername]);

  const handleCompanyLogoUpload = async (file: File) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only JPG, PNG, and SVG images are allowed");
      return;
    }

    if (file.size > 1024 * 1024) {
      toast.error("File size exceeds 1MB limit");
      return;
    } else {
      setLogoSize(file.size);
    }

    try {
      setIsUploadingLogo(true);
      setCompanyLogoName(file.name);

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewLogo(reader.result as string);
      };
      setIsUploadingLogo(false);
      reader.readAsDataURL(file);

      const url = await uploadFile(file);
      setValue("logo", url.url);
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast.error("Failed to upload logo");
    }
  };

  const handleProfileImageUpload = async (file: File) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only JPG, PNG, and SVG images are allowed");
      return;
    }

    if (file.size > 1024 * 1024) {
      toast.error("File size exceeds 1MB limit");
      return;
    } else {
      setProfileImageSize(file.size);
    }
    try {
      setIsUploadingProfileImage(true);
      setProfileImageName(file.name);

      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      setIsUploadingProfileImage(false);
      reader.readAsDataURL(file);

      const url = await uploadFile(file);
      setValue("profile_image", url.url);
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
    }
  };

  const removeFile = () => {
    setValue("profile_image", "");
    setPreviewImage("");
  };

  const removeLogoFile = () => {
    setValue("logo", "");
    setPreviewLogo("");
  };

  const onSubmit = (data: any) => {
    updateSponsorProfile(
      {
        ...data,
        profile_image: data.profile_image || "",
        logo: data.logo || "",
      },
      {
        onSuccess: async () => {
          // Save to local User table
          if (session?.user?.id && session?.user?.email) {
            try {
              await axios.put(`/api/profile/${session.user.id}`, {
                name: `${data.first_name} ${data.last_name}`.trim(),
                bio: data.short_bio || "",
                email: session.user.email,
                notification_email: session.user.email,
                image: data.profile_image || "",
                social_media: [], // Sponsor no tiene social links en este form
                notifications: false,
                profile_privacy: "public",
              });
              console.log("✅ Local sponsor profile updated successfully");
            } catch (error) {
              console.error("❌ Error updating local profile:", error);
            }
          }

          router.push("/ambassador-dao/sponsor");
        },
      }
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center">
        <h2 className="text-[var(--primary-text-color)] text-xl md:text-2xl font-medium">
          Welcome to Team 1
        </h2>
      </div>
      <p className="text-[var(--secondary-text-color)] text-sm mb-8">
        Get access to top global talents
      </p>
      <hr />
      <h3 className="text-[var(--primary-text-color)] font-medium text-xl my-6">
        About you
      </h3>
      <hr />

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="text-[var(--primary-text-color)] text-sm mt-6 md:mt-10 flex flex-col gap-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CustomInput
            id="firstName"
            label="First Name"
            placeholder="First Name"
            required
            {...register("first_name")}
          />
          <CustomInput
            id="lastName"
            label="Last Name"
            placeholder="Last Name"
            required
            {...register("last_name")}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="relative">
            <CustomInput
              id="userName"
              label="User Name"
              placeholder="User Name"
              required
              {...register("username")}
              className="relative"
              icon={
                <>
                  {" "}
                  {usernameStatus === "checking" && (
                    <Loader2
                      className="absolute right-2 animate-spin"
                      size={20}
                      color="currentColor"
                    />
                  )}
                  {usernameStatus === "available" && (
                    <Check
                      className="absolute right-2"
                      size={20}
                      color="#10B981"
                    />
                  )}
                  {usernameStatus === "unavailable" && (
                    <AlertCircle
                      className="absolute right-2"
                      size={20}
                      color="#FB2C36"
                    />
                  )}
                </>
              }
            />
            {usernameStatus === "unavailable" && (
              <p className="text-red-500 text-xs mt-1">
                Username is already taken
              </p>
            )}
            {usernameError && (
              <p className="text-red-500 text-xs mt-1">{usernameError}</p>
            )}
          </div>

          <CustomSelect
            id="location"
            label="Location"
            required
            {...register("location")}
          >
            <option value="">Select location</option>
            {countries.map((country, idx) => (
              <option value={country.name} key={idx} className="capitalize">
                {country.name}
              </option>
            ))}
          </CustomSelect>
        </div>
        <FileUploader
          fileSize={profileImageSize}
          singleFile={true}
          removeFile={removeFile}
          previewUrl={previewImage || profile_image}
          fileName={profileImageName}
          handleFileUpload={handleProfileImageUpload}
          isUploading={isUploadingProfileImage && isUploading}
          accept=".png,.jpg,.jpeg,.svg"
          inputId="profileImage"
          label="Upload Profile Image or Avatar"
          required={true}
          recommendedSize="Add the image here. Recommended size: 512 x 512px (square format)"
          allowedFileTypes="JPG, PNG, SVG"
        />

        <hr />

        <h3 className="text-[var(--primary-text-color)] font-medium text-xl my-6">
          About Your Company
        </h3>

        <hr />

        <div className="mt-6 md:mt-10 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CustomInput
              id="companyName"
              label="Company Name"
              placeholder="Company Name"
              required
              {...register("company_name")}
            />
            <div className="relative">
              <CustomInput
                id="companyUserName"
                label="Company User Name"
                placeholder="Company User Name"
                required
                {...register("company_user_name")}
                className="relative"
                icon={
                  <>
                    {" "}
                    {companyUsernameStatus === "checking" && (
                      <Loader2
                        className="absolute right-2 animate-spin"
                        size={20}
                        color="currentColor"
                      />
                    )}
                    {companyUsernameStatus === "available" && (
                      <Check
                        className="absolute right-2"
                        size={20}
                        color="#10B981"
                      />
                    )}
                    {companyUsernameStatus === "unavailable" && (
                      <AlertCircle
                        className="absolute right-2"
                        size={20}
                        color="#FB2C36"
                      />
                    )}
                  </>
                }
              />
              {companyUsernameStatus === "unavailable" && (
                <p className="text-red-500 text-xs mt-1">
                  Company username is already taken
                </p>
              )}
              {companyUsernameError && (
                <p className="text-red-500 text-xs mt-1">
                  {companyUsernameError}
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CustomInput
              id="companyUrl"
              label="Company Url"
              placeholder="Company Url"
              required
              {...register("website")}
            />
            <CustomInput
              id="companyTwitter"
              label="Company Twitter URL"
              placeholder="https://x.com/company"
              {...register("twitter_url")}
            />
          </div>

          <FileUploader
            fileSize={logoSize}
            singleFile={true}
            removeFile={removeLogoFile}
            previewUrl={previewLogo || logo}
            fileName={companyLogoName}
            handleFileUpload={handleCompanyLogoUpload}
            isUploading={isUploadingLogo && isUploading}
            accept=".png,.jpg,.jpeg,.svg"
            inputId="companyLogoInput"
            label="Company Logo"
            required={true}
            recommendedSize="Add the image here. Recommended size: 512 x 512px (square format)"
            allowedFileTypes="JPG, PNG, SVG"
          />
          <CustomInput
            id="industry"
            label="Industry"
            placeholder="Industry"
            required
            {...register("industry")}
          />
          <CustomInput
            id="companyBio"
            label="Company Short Bio"
            placeholder="Company Short Bio"
            required
            {...register("short_bio")}
          />
        </div>
        <hr className="border-[var(--default-border-color)] my-6" />
        <div className="flex">
          <CustomButton
            isLoading={isUpdatingProfile || isUploading}
            variant="danger"
            type="submit"
            isFullWidth={false}
            className="px-6"
          >
            {isEditProfilePage ? "Submit Updated Details" : "Create Sponsor"}
          </CustomButton>
        </div>
      </form>
    </div>
  );
};
