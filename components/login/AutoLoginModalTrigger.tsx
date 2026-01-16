"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useLoginModalTrigger } from "@/hooks/useLoginModal";

const protectedPaths = [
  "/hackathons/registration-form",
  "/hackathons/project-submission",
  "/showcase",
  "/profile",
  "/student-launchpad",
  "/console/utilities/data-api-keys"
];

export function AutoLoginModalTrigger() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const { openLoginModal } = useLoginModalTrigger();
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    // Only trigger on client side
    if (typeof window === "undefined") return;

    // Reset trigger when pathname changes
    if (hasTriggeredRef.current) {
      hasTriggeredRef.current = false;
    }

    // Wait for session to be determined
    if (status === "loading") return;

    // Check if user is not authenticated
    if (status === "unauthenticated" && !hasTriggeredRef.current) {
      // Check if current path is protected
      const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));

      if (isProtectedPath) {
        // Mark as triggered to prevent multiple opens
        hasTriggeredRef.current = true;
        
        // Small delay to ensure the page has rendered
        const timer = setTimeout(() => {
          // Get current URL with search params for callback
          const currentUrl = window.location.href;
          // Open login modal with current URL as callback
          openLoginModal(currentUrl);
        }, 100);

        return () => clearTimeout(timer);
      }
    }
  }, [status, pathname, openLoginModal]);

  return null;
}
