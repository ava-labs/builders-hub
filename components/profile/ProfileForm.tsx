"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import ProfileTab from "./components/profile-tab";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";

const LegacyProfileForm = dynamic(
  () => import("./components/LegacyProfileForm"),
  { ssr: false },
);

interface LegacyInitialData {
  name: string;
  bio?: string;
  email: string;
  notification_email: string;
  image?: string;
  additional_social_media: string[];
  notifications: boolean | null;
  profile_privacy: string;
  telegram_account?: string;
}

interface ProfileFormProps {
  initialData: LegacyInitialData;
  id: string;
  achievements?: ReactNode;
  referralPanel?: ReactNode;
  teamLabel?: string | null;
}

export default function ProfileForm({
  initialData,
  id,
  achievements,
  referralPanel,
  teamLabel,
}: ProfileFormProps) {
  const isNewProfileEnabled = useFeatureFlag("new-profile-ui", true);

  if (isNewProfileEnabled) {
    return (
      <ProfileTab
        achievements={achievements}
        referralPanel={referralPanel}
        teamLabel={teamLabel}
      />
    );
  }

  return <LegacyProfileForm initialData={initialData} id={id} />;
}
