"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useLoginModalTrigger } from "@/hooks/useLoginModal";

interface SubmitButtonProps {
  hackathonId: string;
  customSubmissionLink?: string | null;
  className?: string;
  variant?: "red" | "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  label?: string;
  isAuthenticated?: boolean;
}

export default function SubmitButton({
  hackathonId,
  customSubmissionLink,
  className = "w-2/5 md:w-1/3 lg:w-1/4",
  variant = "red",
  label = "Submit project",
  isAuthenticated = false,
}: SubmitButtonProps) {
  const { status } = useSession();
  const { openLoginModal } = useLoginModalTrigger();

  const href = customSubmissionLink ?? `/events/project-submission?event=${hackathonId}`;
  const target = customSubmissionLink ? "_blank" : "_self";

  const handleClick = (e: React.MouseEvent) => {
    if (!isAuthenticated && status !== "authenticated") {
      e.preventDefault();
      openLoginModal(href);
    }
  };

  return (
    <Button asChild variant={variant} className={className}>
      <Link href={href} target={target} onClick={handleClick} className="text-s sm:text-base">
        {label}
      </Link>
    </Button>
  );
}
