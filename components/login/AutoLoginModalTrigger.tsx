"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useLoginModalTrigger } from "@/hooks/useLoginModal";
import { captureReferralAttributionFromUrl } from "@/lib/referrals/client";

const protectedPaths = [
  "/hackathons/registration-form",
  "/hackathons/project-submission",
  "/events/registration-form",
  "/events/project-submission",
  "/showcase",
  "/profile",
  "/student-launchpad",
  "/console/utilities/data-api-keys",
  "/build-games/apply"
];

export function AutoLoginModalTrigger() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const { openLoginModal } = useLoginModalTrigger();
  const hasTriggeredRef = useRef(false);
  const statusRef = useRef(status);

  // Keep statusRef in sync with current status
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const triggerLoginModal = useCallback(async () => {
    // Double-check status hasn't changed to authenticated during the delay
    if (statusRef.current === "authenticated") {
      return;
    }

    // Get current URL with search params for callback
    const currentUrl = window.location.href;
    captureReferralAttributionFromUrl();
    // Open login modal with current URL as callback
    openLoginModal(currentUrl);
  }, [openLoginModal]);

  useEffect(() => {
    // Only trigger on client side
    if (typeof window === "undefined") return;

    // Reset trigger when pathname changes
    if (hasTriggeredRef.current) {
      hasTriggeredRef.current = false;
    }

    // Wait for session to be determined
    if (status === "loading") return;

    // If already authenticated, don't show modal
    if (status === "authenticated" || session) return;

    // Check if user is not authenticated
    if (status === "unauthenticated" && !hasTriggeredRef.current) {
      // Check if current path is protected
      const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
      const isSignupReferralLanding =
        pathname === "/" && new URLSearchParams(window.location.search).has("ref");

      if (isProtectedPath || isSignupReferralLanding) {
        // Mark as triggered to prevent multiple opens
        hasTriggeredRef.current = true;

        // Longer delay to allow session to sync from server-side render
        const timer = setTimeout(() => {
          triggerLoginModal();
        }, 500);

        return () => clearTimeout(timer);
      }
    }
  }, [status, session, pathname, triggerLoginModal]);

  return null;
}
