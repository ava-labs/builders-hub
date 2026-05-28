"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import posthog from "posthog-js";
import {
  captureReferralAttributionFromUrl,
  clearStoredReferralAttribution,
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

        // PostHog persists $initial_utm_* on the anonymous distinct_id from the
        // first pageview and carries them through identify(), so attribution
        // survives OAuth redirects and cross-page navigation without us
        // threading UTM params on URLs.
        posthog.capture("user_created", {
          auth_provider: session.user.authentication_mode,
          utm_source: posthog.get_property("$initial_utm_source") || undefined,
          utm_medium: posthog.get_property("$initial_utm_medium") || undefined,
          utm_campaign: posthog.get_property("$initial_utm_campaign") || undefined,
          utm_content: posthog.get_property("$initial_utm_content") || undefined,
          utm_term: posthog.get_property("$initial_utm_term") || undefined,
          referral_code: getStoredReferralAttribution()?.referralCode || undefined,
          referrer: document.referrer || undefined,
        });

        fetch("/api/referrals/attribution", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            referral_attribution: getStoredReferralAttribution(),
          }),
          keepalive: true,
        })
          .then(async (response) => {
            if (!response.ok) return;
            const result = await response.json();
            if (result.attribution) clearStoredReferralAttribution();
          })
          .catch((error) => {
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
  }, [session, status]);
}
