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
              className={`rounded-xl border border-[#27272A] bg-[#09090B] p-6 flex-1 cursor-pointer
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
                <div className="text-[#FAFAFA]">
                  <p className="font-medium text-2xl md:text-3xl">
                    Continue as <span className="capitalize">{type.name}</span>
                  </p>
                  <p>{type.description}</p>
                </div>
              </div>

              <hr className="my-6 border-[#27272A]" />

              <div className="bg-black rounded-md h-36 md:h-44 relative overflow-hidden">
                <Image
                  src={Avalance3d}
                  objectFit="contain"
                  alt="avalance icon"
                  className="absolute right-0"
                />
              </div>

              <hr className="my-6 border-[#27272A]" />

              <div className="flex flex-col space-y-2">
                {type.perks.map((perk, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 text-[#FAFAFA]"
                  >
                    <Check color="white" size={16} />
                    <p className="text-sm">{perk}</p>
                  </div>
                ))}
              </div>

              <hr className="my-6 border-[#27272A]" />

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
                  Continue as <span className="capitalize">{type.name}</span>
                </CustomButton>
              </div>
            </div>
          ))}
        </div>
      )}
      {selectionStep === "account_form" && (
        <div className="bg-[#09090B] rounded-xl border border-[#27272A] p-6 py-10">
          {userType === ("USER" as "TALENT") && (
            <TalentForm handleClose={handleClose} />
          )}
          {userType === "SPONSOR" && <SponsorForm handleClose={handleClose} />}
        </div>
      )}
    </div>
  );
};

export default AmbasssadorDaoOnboardPage;

const TalentForm = ({ handleClose }: { handleClose: () => void }) => {
  const router = useRouter();
  const { data: userData } = useFetchUserDataQuery();
  const [isDataFetched, setIsDataFetched] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<IUpdateTalentProfileBody>({
    defaultValues: {
      first_name: "",
      last_name: "",
      username: "",
    },
  });
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [socialLinks, setSocialLinks] = useState<string[]>([]);
  const [currentSocialLink, setCurrentSocialLink] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<
    "checking" | "available" | "unavailable" | null
  >(null);
  const [profileImageName, setProfileImageName] = useState<string>("");
  const [stage, setStage] = useState(1);

  const pathname = usePathname();

  const isEditProfilePage = pathname === "/ambassador-dao/edit-profile";
  const isOnboardPage = pathname === "/ambassador-dao/onboard";

  const username = watch("username");

  const { mutate: updateTalentProfile, isPending: isUpdatingProfile } =
    useUpdateTalentProfileMutation();
  const { mutate: checkUsername } = useCheckUsernameAvailabilityMutation();
  const { data: skills } = useFetchAllSkills();

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
      });

      if (userData.skills_ids && userData.skills_ids.length > 0) {
        setSelectedSkills(userData.skills_ids);
      }

      if (userData.social_links && userData.social_links.length > 0) {
        setSocialLinks(userData.social_links);
      }
      if (!isEditProfilePage && userData.first_name) {
        setStage(2);
      } else {
        setStage(1);
      }

      setIsDataFetched(true);
    }
  }, [userData, router, isEditProfilePage, isOnboardPage, reset]);

  useEffect(() => {
    if (username && username.length > 3) {
      // Don't check username if it's the same as user's current username
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
          onError: () => {
            setUsernameStatus("unavailable");
          },
        });
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setUsernameStatus(null);
    }
  }, [username, checkUsername, userData?.username]);

  const addSkill = (skill: string) => {
    if (!selectedSkills.includes(skill) && skill) {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  const removeSkill = (skill: string) => {
    const updated = selectedSkills.filter((s) => s !== skill);
    setSelectedSkills(updated);
    setValue("skills_ids", updated);
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

  const onSubmit = (data: any) => {
    updateTalentProfile(
      {
        ...data,
        skills_ids: selectedSkills,
        social_links: socialLinks,
      },
      {
        onSuccess: () => {
          if (isEditProfilePage) {
            toast.success("Profile updated successfully");
            // Optionally redirect after edit profile update
            // router.push("/ambassador-dao");
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
        onSuccess: () => {
          router.push("/ambassador-dao/jobs");
        },
      }
    );
  };

  const { mutateAsync: updateTalentWallet, isPending: isConnectingWallet } =
    useUpdateWalletAddress();

  // Show loading indicator until we've fetched user data
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
        <h2 className="text-[#FAFAFA] text-xl md:text-2xl font-medium">
          {isEditProfilePage
            ? stage === 1
              ? "Edit Your Profile"
              : "Update Wallet Address"
            : stage === 1
            ? "Finish Your Profile"
            : "Add a wallet address"}
        </h2>
      </div>
      <p className="text-[#9F9FA9] text-sm">
        {isEditProfilePage
          ? "Update your profile information and wallet details."
          : "It takes less than a minute to start earning in global standards."}
      </p>

      <hr className="border-[#27272A] my-6" />

      {stage === 1 && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="text-[#FAFAFA] text-sm mt-6 md:mt-10 flex flex-col gap-4"
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
                        color="#9F9FA9"
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
          <div>
            <div className="my-2">
              <p className="block text-sm mb-2">
                Your skills
                <span className="text-[#FB2C36]">*</span>
              </p>
            </div>
            <div className="w-full h-12 flex flex-wrap gap-2 px-2 py-2 rounded-md bg-[#09090B] border border-[#27272A] text-[#FAFAFA] focus:outline-none focus:border-[#FB2C36] overflow-x-auto">
              {selectedSkills &&
                !!selectedSkills.length &&
                selectedSkills.map((badge, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 bg-[#fff] text-[#18181B] rounded-full px-2 text-sm cursor-pointer capitalize"
                    onClick={() => removeSkill(badge)}
                  >
                    {skills?.find((skill) => skill.id === badge)?.name}
                    <X size={16} color="#18181B" />
                  </div>
                ))}
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {skills &&
                !!skills.length &&
                skills.map((badge, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 bg-[#09090B] border border-[#27272A] rounded-full px-3 py-1 text-sm cursor-pointer capitalize"
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
          <div>
            <CustomInput
              id="socials"
              label="Socials"
              placeholder="Socials"
              value={currentSocialLink}
              onChange={(e) => setCurrentSocialLink(e.target.value)}
            />
            <div className="flex justify-end">
              <button
                type="button"
                className="flex items-center text-sm text-[#A1A1AA]"
                onClick={addSocialLink}
              >
                <Plus size={14} color="#A1A1AA" /> Add Link
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            {socialLinks.map((link, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 bg-[#09090B] border border-[#27272A] rounded-full px-3 py-1 text-sm cursor-pointer"
                onClick={() => removeSocialLink(link)}
              >
                {link}
                <Minus size={16} color="#A1A1AA" />
              </div>
            ))}
          </div>

          <hr className="border-[#27272A] my-6" />
          <div className="flex justify-between">
            <CustomButton
              isLoading={isUpdatingProfile}
              variant="danger"
              type="submit"
              isFullWidth={false}
              className="px-6"
              disabled={
                usernameStatus !== "available" ||
                !socialLinks.length ||
                !selectedSkills.length
              }
            >
              {isEditProfilePage ? "Update Profile" : "Create Profile"}
            </CustomButton>

            {isEditProfilePage && (
              <CustomButton
                variant="outlined"
                type="button"
                isFullWidth={false}
                className="px-6"
                onClick={() => setStage(2)}
              >
                Edit Wallet
              </CustomButton>
            )}
          </div>
        </form>
      )}

      {stage === 2 && (
        <form
          onSubmit={handleSubmit(onSubmitWallet)}
          className="text-[#FAFAFA] text-sm mt-6 md:mt-10 flex flex-col gap-4"
        >
          <CustomInput
            id="wallet_address"
            label="Enter Wallet Address"
            placeholder="Enter Wallet Address"
            required
            defaultValue={userData?.wallet_address || ""}
            {...register("wallet_address")}
          />

          <hr className="border-[#27272A] my-6" />
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

const SponsorForm = ({ handleClose }: { handleClose: () => void }) => {
  const { data: userData } = useFetchUserDataQuery();
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
    },
  });

  const [usernameStatus, setUsernameStatus] = useState<
    "checking" | "available" | "unavailable" | null
  >(null);
  const [companyUsernameStatus, setCompanyUsernameStatus] = useState<
    "checking" | "available" | "unavailable" | null
  >(null);
  const [profileImageName, setProfileImageName] = useState<string>("");
  const [companyLogoName, setCompanyLogoName] = useState<string>("");

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

  useEffect(() => {
    if (username && username.length > 3) {
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
          onError: () => {
            setUsernameStatus("unavailable");
          },
        });
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setUsernameStatus(null);
    }
  }, [username, checkUsername]);

  useEffect(() => {
    if (company_username && company_username.length > 3) {
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
          onError: () => {
            setCompanyUsernameStatus("unavailable");
          },
        });
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setCompanyUsernameStatus(null);
    }
  }, [company_username, checkCompanyUsername]);

  const handleProfileImageUpload = async (file: File) => {
    setProfileImageName(file.name);
    const url = await uploadFile(file);
    setValue("profile_image", url.url);
  };

  const handleCompanyLogoUpload = async (file: File) => {
    setCompanyLogoName(file.name);
    const url = await uploadFile(file);
    setValue("logo", url.url);
  };

  const onSubmit = (data: any) => {
    updateSponsorProfile(
      {
        ...data,
        profile_image: data.profile_image || "",
        logo: data.logo || "",
      },
      {
        onSuccess: () => {
          router.push("/ambassador-dao/sponsor");
        },
      }
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center">
        <h2 className="text-[#FAFAFA] text-xl md:text-2xl font-medium">
          Welcome to Ambassador DAO
        </h2>
        {/* <button
          onClick={handleClose}
          className='text-[#FAFAFA] hover:bg-[#27272A] p-1 rounded-md'
        >
          <X size={20} color='#9F9FA9' />
        </button> */}
      </div>
      <p className="text-[#9F9FA9] text-sm mb-8">
        It takes less than a minute to start earning in global standards.
      </p>
      <hr />
      <h3 className="text-[#FAFAFA] font-medium text-xl my-6">About you</h3>
      <hr />

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="text-[#FAFAFA] text-sm mt-6 md:mt-10 flex flex-col gap-4"
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
                      color="#9F9FA9"
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
        <div className="mb-6">
          <label className="block text-sm">
            Upload Profile Image or Avatar
            <span className="text-[#FB2C36]">*</span>
          </label>
          <p className="text-xs text-[#A1A1AA] mb-2">
            Add the image here. Recommended size: 512 x 512px (square format)
          </p>
          {profile_image ? (
            <div className="rounded-md my-2 flex justify-between items-center border border-[#27272A] p-3 text-sm">
              {profileImageName}
              <X
                onClick={() => {
                  setValue("profile_image", "");
                  setProfileImageName("");
                  getValues("profile_image");
                }}
                className="cursor-pointer"
                color="white"
                size={16}
              />
            </div>
          ) : (
            <div className="border border-dashed border-[#27272A] rounded-md p-6 flex flex-col items-center justify-center h-32">
              {isUploading ? (
                <>
                  <Loader2 className="animate-spin" color="white" size={24} />
                </>
              ) : (
                <>
                  {" "}
                  <Upload
                    size={24}
                    className="text-[#A1A1AA] mb-2"
                    color="white"
                  />
                  <p className="text-sm text-[#A1A1AA]">
                    Drag your file(s) or{" "}
                    <input
                      type="file"
                      className="hidden"
                      id="profileImage"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleProfileImageUpload(e.target.files[0]);
                        }
                      }}
                    />
                    <label
                      htmlFor="profileImage"
                      className="text-[#FAFAFA] underline cursor-pointer"
                    >
                      browse
                    </label>
                  </p>
                  <p className="text-xs text-[#A1A1AA] mt-1">
                    Max 1 MB files are allowed
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        <hr />

        <h3 className="text-[#FAFAFA] font-medium text-xl my-6">
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
                        color="#9F9FA9"
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
              label="Company Twitter"
              placeholder="Company Twitter"
              {...register("twitter_url")}
            />
          </div>
          <div className="">
            <label className="block text-sm">
              Company Logo<span className="text-[#FB2C36]">*</span>
            </label>
            <p className="text-xs text-[#A1A1AA] mb-2">
              Add the image here. Recommended size: 512 x 512px (square format)
            </p>
            {logo ? (
              <div className="rounded-md my-2 flex justify-between items-center border border-[#27272A] p-3 text-sm">
                {companyLogoName}
                <X
                  onClick={() => {
                    setValue("logo", "");
                    setCompanyLogoName("");
                  }}
                  className="cursor-pointer"
                  color="white"
                  size={16}
                />
              </div>
            ) : (
              <div className="border border-dashed border-[#27272A] rounded-md p-6 flex flex-col items-center justify-center h-32">
                {isUploading ? (
                  <>
                    <Loader2 className="animate-spin" color="white" size={24} />
                  </>
                ) : (
                  <>
                    {" "}
                    <Upload
                      size={24}
                      className="text-[#A1A1AA] mb-2"
                      color="white"
                    />
                    <p className="text-sm text-[#A1A1AA]">
                      Drag your file(s) or{" "}
                      <input
                        type="file"
                        className="hidden"
                        id="profileImage"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleCompanyLogoUpload(e.target.files[0]);
                          }
                        }}
                      />
                      <label
                        htmlFor="profileImage"
                        className="text-[#FAFAFA] underline cursor-pointer"
                      >
                        browse
                      </label>
                    </p>
                    <p className="text-xs text-[#A1A1AA] mt-1">
                      Max 1 MB files are allowed
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
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
        <hr className="border-[#27272A] my-6" />
        <div className="flex">
          <CustomButton
            isLoading={isUpdatingProfile || isUploading}
            disabled={
              companyUsernameStatus !== "available" ||
              usernameStatus !== "available"
            }
            variant="danger"
            type="submit"
            isFullWidth={false}
            className="px-6"
          >
            Create Sponsor
          </CustomButton>
        </div>
      </form>
    </div>
  );
};
