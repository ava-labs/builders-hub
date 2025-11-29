"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface SubmitButtonProps {
  hackathonId: string;
  customSubmissionLink?: string | null;
  className?: string;
  variant?: "red" | "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
}

export default function SubmitButton({
  hackathonId,
  customSubmissionLink,
  className = "w-2/5 md:w-1/3 lg:w-1/4",
  variant = "red",
}: SubmitButtonProps) {
  const { status } = useSession();
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    if (status === "unauthenticated") {
      e.preventDefault();
      // Redirect to login with current hackathon page + #submission anchor as callback
      const currentPage = window.location.pathname + window.location.search;
      const callbackWithAnchor = `${currentPage}#submission`;
      router.push(`/login?callbackUrl=${encodeURIComponent(callbackWithAnchor)}`);
    }
  };

  const getSubmissionHref = () => {
    // Use custom link if it exists, otherwise use internal form
    // This matches the original ternary: condition ? custom : internal
    if (customSubmissionLink) {
      return customSubmissionLink;
    }
    return `/hackathons/project-submission?hackathon=${hackathonId}`;
  };

  const getTarget = () => {
    // Open custom links in new tab, internal form in same tab
    return customSubmissionLink ? "_blank" : "_self";
  };

  return (
    <Button asChild variant={variant} className={className}>
      <Link
        href={getSubmissionHref()}
        target={getTarget()}
        onClick={handleClick}
        className="text-s sm:text-base"
      >
        Submit project
      </Link>
    </Button>
  );
}

