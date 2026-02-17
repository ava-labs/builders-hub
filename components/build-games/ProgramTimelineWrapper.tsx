"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";

const ProgramTimeline = dynamic(() => import("./ProgramTimeline"), {
  ssr: false,
});

interface ApplicationData {
  id: string;
  firstName: string;
  projectName: string;
  createdAt: string;
}

export default function ProgramTimelineWrapper() {
  const { status } = useSession();
  const [hasApplied, setHasApplied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Only fetch when authenticated
    if (status !== "authenticated") {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetch("/api/build-games/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.hasApplied && data.application) {
          setHasApplied(true);
        }
      })
      .catch((error) => {
        console.error("Error fetching application status:", error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [status]);

  // Don't render if not authenticated, not applied, or still loading
  if (status === "loading" || isLoading || !hasApplied) {
    return null;
  }

  return <ProgramTimeline />;
}
