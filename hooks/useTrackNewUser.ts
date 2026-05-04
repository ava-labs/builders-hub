"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import {
  captureReferralAttributionFromUrl,
  getStoredReferralAttribution,
} from "@/lib/referrals/client";

/**
 * Hook to track new user creation in PostHog.
 *
 * This hook identifies new users and captures a "user_created" event with
 * attribution data (UTM parameters, referrer). Deduplication is handled via
 * localStorage to ensure each user is only tracked once.
 *
 * @returns void - This hook only performs side effects
 */
export function useTrackNewUser(): void {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    captureReferralAttributionFromUrl();

    // Only proceed if authenticated with a new user
    if (status !== "authenticated" || !session?.user?.is_new_user) {
      return;
    }

    const userId = session.user.id;
    const trackingKey = `posthog_user_created_${userId}`;

    // Check if already tracked (localStorage handles deduplication across all scenarios)
    if (typeof window === "undefined" || localStorage.getItem(trackingKey)) {
      return;
    }

    // Mark as tracked immediately to prevent any race conditions
    localStorage.setItem(trackingKey, "true");

    /**
     * Track the new user in PostHog.
     * PostHog's library handles queuing internally if not yet initialized.
     */
    const trackUser = (): void => {
      // Safety check - don't track if component unmounted
      if (!isMountedRef.current) return;

      try {
        // Identify the user
        posthog.identify(userId, {
          email: session.user.email,
          name: session.user.name,
        });

        // Capture the user_created event with attribution data
        posthog.capture("user_created", {
          auth_provider: session.user.authentication_mode,
          utm_source: searchParams.get("utm_source") || undefined,
          utm_medium: searchParams.get("utm_medium") || undefined,
          utm_campaign: searchParams.get("utm_campaign") || undefined,
          utm_content: searchParams.get("utm_content") || undefined,
          utm_term: searchParams.get("utm_term") || undefined,
          referral_code: getStoredReferralAttribution()?.referralCode || undefined,
          referrer: document.referrer || undefined,
        });

        fetch("/api/referrals/attribution", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversionType: "bh_signup",
            convertedUserId: userId,
            convertedEmail: session.user.email,
            attribution: getStoredReferralAttribution(),
          }),
          keepalive: true,
        }).catch((error) => {
          console.error("[useTrackNewUser] Failed to record referral attribution:", error);
        });
      } catch (error) {
        // Log error but don't throw - tracking failures shouldn't break the app
        console.error("[useTrackNewUser] Failed to track new user:", error);
      }
    };

    trackUser();

    return () => {
      isMountedRef.current = false;
    };
  }, [session, status, searchParams]);
}
