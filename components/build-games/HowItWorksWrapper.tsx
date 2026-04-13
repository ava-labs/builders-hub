"use client";

import { useState, useEffect, ReactNode } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/api/client";

interface HowItWorksWrapperProps {
  children: ReactNode;
}

export default function HowItWorksWrapper({ children }: HowItWorksWrapperProps) {
  const { status } = useSession();
  const [hasApplied, setHasApplied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // If not authenticated, show the section
    if (status === "unauthenticated") {
      setIsLoading(false);
      setHasApplied(false);
      return;
    }

    // Only fetch when authenticated
    if (status !== "authenticated") {
      return;
    }

    setIsLoading(true);
    apiFetch<{ hasApplied: boolean; application?: unknown }>("/api/build-games/status")
      .then((data) => {
        if (data.hasApplied && data.application) {
          setHasApplied(true);
        } else {
          setHasApplied(false);
        }
      })
      .catch((error) => {
        console.error("Error fetching application status:", error);
        setHasApplied(false);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [status]);

  // Show loading state or nothing while checking
  if (status === "loading" || isLoading) {
    return null;
  }

  // Only render for users who haven't applied
  if (hasApplied) {
    return null;
  }

  return <>{children}</>;
}
