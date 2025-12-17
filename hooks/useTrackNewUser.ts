"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import posthog from "posthog-js";

// Module-level flag to prevent race conditions across component instances
// This ensures only one tracking call happens even if multiple components mount simultaneously
let isTrackingInProgress = false;

/**
 * Hook to track new user creation in PostHog.
 *
 * Features:
 * - Checks if PostHog is initialized before calling identify/capture
 * - Prevents duplicate tracking via localStorage + module-level flag
 * - Captures UTM parameters and referrer for attribution
 *
 * @returns void - This hook only performs side effects
 */
export function useTrackNewUser(): void {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const hasTrackedRef = useRef(false);

  useEffect(() => {
    // Only proceed if authenticated with a new user
    if (status !== "authenticated" || !session?.user?.is_new_user) {
      return;
    }

    // Skip if already tracked in this component instance
    if (hasTrackedRef.current) {
      return;
    }

    const userId = session.user.id;
    const trackingKey = `posthog_user_created_${userId}`;

    // Check localStorage first (handles persistence across page loads)
    if (typeof window === "undefined" || localStorage.getItem(trackingKey)) {
      return;
    }

    // Check module-level flag (handles race conditions from concurrent mounts)
    if (isTrackingInProgress) {
      return;
    }

    // Set flags BEFORE async operations to prevent race conditions
    isTrackingInProgress = true;
    hasTrackedRef.current = true;
    localStorage.setItem(trackingKey, "true");

    // Check if PostHog is initialized and ready
    // posthog-js sets __loaded to true once initialization is complete
    const isPostHogReady =
      typeof posthog !== "undefined" &&
      typeof posthog.identify === "function" &&
      typeof posthog.capture === "function" &&
      (posthog as unknown as { __loaded?: boolean }).__loaded === true;

    if (!isPostHogReady) {
      // PostHog not ready - flags are already set so we won't retry
      // This prevents duplicate events if PostHog loads later
      isTrackingInProgress = false;
      return;
    }

    try {
      // Identify the user in PostHog
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
        referrer: document.referrer || undefined,
      });
    } finally {
      isTrackingInProgress = false;
    }
  }, [session, status, searchParams]);
}
