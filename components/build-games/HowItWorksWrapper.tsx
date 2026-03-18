"use client";

import { useState, useEffect, ReactNode } from "react";
import { useSession } from "next-auth/react";

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
    fetch("/api/build-games/status")
      .then((res) => res.json())
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
