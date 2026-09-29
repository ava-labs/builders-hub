"use client";

import Formlogin from "./FormLogin";
import { useEffect } from "react";
import { captureReferralAttributionFromUrl } from "@/lib/referrals/client";
import { useLoginCompleteListener } from "@/hooks/useLoginModal";
import { getAuthCallbackUrl } from "@/lib/auth/callback-url";

export default function FormLoginWrapper({
  callbackUrl = "/",
  mode = "signin",
}: {
  callbackUrl?: string;
  mode?: "signin" | "signup";
}) {
  const destination = getAuthCallbackUrl(callbackUrl);

  useEffect(() => {
    // Persist attribution before Google/GitHub navigate away from the page.
    captureReferralAttributionFromUrl();
  }, []);

  useLoginCompleteListener(() => {
    // New email users finish Terms and the optional Basic Setup here first.
    window.location.assign(destination);
  });

  return <Formlogin callbackUrl={destination} mode={mode} />;
}
