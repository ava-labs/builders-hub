import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import axios from "axios";
import toast from "react-hot-toast";
import { useFileUploadMutation, useUpdateTalentProfileMutation } from "@/services/ambassador-dao/requests/onboard";
import { UseFormSetValue, UseFormWatch } from "react-hook-form";
import { IUpdateTalentProfileBody } from "@/services/ambassador-dao/interfaces/onbaord";

interface UseTalentProfileProps {
  setValue: UseFormSetValue<IUpdateTalentProfileBody>;
  watch: UseFormWatch<IUpdateTalentProfileBody>;
  selectedSkills: string[];
  socialLinks: string[];
  setIsDataFetched: (value: boolean) => void;
}

export const useTalentProfile = ({
  setValue,
  watch,
  selectedSkills,
  socialLinks,
  setIsDataFetched,
}: UseTalentProfileProps) => {
  const router = useRouter();
  const { data: session } = useSession();
  const [localProfileData, setLocalProfileData] = useState<any>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isUploadingProfileImage, setIsUploadingProfileImage] = useState(false);
  const [profileImageName, setProfileImageName] = useState<string>("");
  const [profileImageSize, setProfileImageSize] = useState<number>();

  const { mutateAsync: uploadFile, isPending: isUploading } = useFileUploadMutation("image");
  const { mutate: updateTalentProfile } = useUpdateTalentProfileMutation();

  // Fetch local profile data to get bio, image, etc.
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

  // Handle profile image upload
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

  // Remove profile image
  const removeFile = () => {
    setValue("profile_image", "");
    setPreviewImage("");
  };

  // Save to local User table
  const saveToLocalProfile = async (formData: any) => {
    if (session?.user?.id && session?.user?.email) {
      try {
        await axios.put(`/api/profile/${session.user.id}`, {
          name: `${formData.first_name} ${formData.last_name}`.trim(),
          bio: formData.bio || "",
          email: session.user.email,
          notification_email: session.user.email,
          image: formData.profile_image || "",
          social_media: socialLinks || [],
          notifications: formData.notifications,
          profile_privacy: formData.profile_privacy,
          telegram_user: formData.telegram_user || "",
        });
        console.log("✅ Local profile updated successfully");
      } catch (error) {
        console.error("❌ Error updating local profile:", error);
        throw error;
      }
    }
  };

  // Skip function
  const onSkip = async () => {
    // Validate that first_name is filled before allowing skip
    const currentFirstName = watch("first_name");
    if (!currentFirstName || currentFirstName.trim() === "") {
      toast.error("First name is required to continue.");
      return;
    }

    // Save the current form data before skipping
    setIsDataFetched(false); // Show loading
    try {
      const formData = watch();

      // Save to Ambassador API
      await new Promise((resolve, reject) => {
        updateTalentProfile(
          {
            ...formData,
            skill_ids: selectedSkills,
            social_links: socialLinks,
            years_of_experience: formData.years_of_experience,
          },
          {
            onSuccess: () => resolve(true),
            onError: (error: any) => reject(error),
          }
        );
      });

      // Save to local User table
      await saveToLocalProfile(formData);

      toast.success("Profile saved successfully!");
      router.push("/ambassador-dao");
    } catch (error) {
      console.error(error);
      toast.error("Error while saving profile.");
    } finally {
      setIsDataFetched(true);
    }
  };

  return {
    // States
    localProfileData,
    previewImage,
    isUploadingProfileImage,
    profileImageName,
    profileImageSize,
    isUploading,
    
    // Functions
    handleProfileImageUpload,
    removeFile,
    saveToLocalProfile,
    onSkip,
  };
};

