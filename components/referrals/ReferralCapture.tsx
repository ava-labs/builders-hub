"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { captureReferralAttributionFromUrl } from "@/lib/referrals/client";

export function ReferralCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    captureReferralAttributionFromUrl();
  }, [searchParams]);

  return null;
}
