"use client";

import { Suspense } from "react";
import { useTrackNewUser } from "@/hooks/useTrackNewUser";

/**
 * Wrapper component that calls the useTrackNewUser hook.
 * Separated to allow Suspense boundary for useSearchParams.
 */
function TrackNewUserWrapper() {
  useTrackNewUser();
  return null;
}

/**
 * Component to track new user creation in PostHog.
 *
 * Wrap this in a SessionProvider and place it in your layout to automatically
 * track when new users are created. The tracking is deduplicated across
 * multiple instances and page loads.
 *
 * @example
 * ```tsx
 * <SessionProvider>
 *   <TrackNewUser />
 *   {children}
 * </SessionProvider>
 * ```
 */
export function TrackNewUser() {
  return (
    <Suspense fallback={null}>
      <TrackNewUserWrapper />
    </Suspense>
  );
}
