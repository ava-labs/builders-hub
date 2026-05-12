"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import ProfilePage from "../redesign/ProfilePage";

const LegacyProfileTab = dynamic(() => import("./LegacyProfileTab"), {
  ssr: false,
});

interface ProfileTabProps {
  achievements?: ReactNode;
  referralPanel?: ReactNode;
  teamLabel?: string | null;
}

export default function ProfileTab({ achievements, referralPanel, teamLabel }: ProfileTabProps) {
  // Redesigned profile page (Avalanche dark theme). Gated behind a separate
  // flag so we can ramp the redesign independently from the existing
  // `new-profile-ui` flag that turned on the current four-tab layout.
  const isProfileRedesignEnabled = useFeatureFlag('profile-redesign-ui', true);
  if (isProfileRedesignEnabled) {
    return (
      <ProfilePage
        achievements={achievements}
        referralPanel={referralPanel}
        teamLabel={teamLabel}
      />
    );
  }
  return <LegacyProfileTab achievements={achievements} referralPanel={referralPanel} teamLabel={teamLabel} />;
}
