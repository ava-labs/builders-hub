"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import posthog from "posthog-js";

// Module-level flag to prevent race conditions across component instances
// This ensures only one tracking call happens even if multiple components mount simultaneously
let isTrackingInProgress = false;

// Maximum number of retry attempts for PostHog initialization
const MAX_RETRY_ATTEMPTS = 5;
// Delay between retry attempts in milliseconds
const RETRY_DELAY_MS = 500;

/**
 * Hook to track new user creation in PostHog.
 *
 * Features:
 * - Checks if PostHog is initialized before calling identify/capture
 * - Retries tracking if PostHog is not yet ready (up to MAX_RETRY_ATTEMPTS)
 * - Prevents duplicate tracking via localStorage + module-level flag
 * - Captures UTM parameters and referrer for attribution
 *
 * @returns void - This hook only performs side effects
 */
export function useTrackNewUser(): void {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const hasTrackedRef = useRef(false);
  const retryCountRef = useRef(0);

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

    /**
     * Check if PostHog is initialized and ready.
     * posthog-js sets __loaded to true once initialization is complete.
     */
    const isPostHogReady = (): boolean =>
      typeof posthog !== "undefined" &&
      typeof posthog.identify === "function" &&
      typeof posthog.capture === "function" &&
      (posthog as unknown as { __loaded?: boolean }).__loaded === true;

    /**
     * Perform the actual tracking call to PostHog.
     */
    const performTracking = (): void => {
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

      // Mark as tracked in localStorage for persistence across page loads
      localStorage.setItem(trackingKey, "true");
      hasTrackedRef.current = true;
      isTrackingInProgress = false;
    };

    /**
     * Attempt to track with retry logic if PostHog is not ready.
     */
    const attemptTracking = (): void => {
      if (isPostHogReady()) {
        performTracking();
      } else if (retryCountRef.current < MAX_RETRY_ATTEMPTS) {
        // PostHog not ready yet - schedule a retry
        retryCountRef.current += 1;
        setTimeout(attemptTracking, RETRY_DELAY_MS);
      } else {
        // Max retries exceeded - give up to avoid blocking
        // User will be tracked on their next session if PostHog loads
        isTrackingInProgress = false;
      }
    };

    // Set flag to prevent concurrent tracking attempts
    isTrackingInProgress = true;
    attemptTracking();

    // Cleanup: reset tracking flag if component unmounts during retry
    return () => {
      if (!hasTrackedRef.current) {
        isTrackingInProgress = false;
      }
    };
  }, [session, status, searchParams]);
}
