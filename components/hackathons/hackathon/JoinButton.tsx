"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface JoinButtonProps {
  isRegistered: boolean;
  hackathonId: string;
  customLink?: string;
  customText?: string;
  className?: string;
  variant?: "red" | "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  showChatWhenRegistered?: boolean; // New prop to control behavior
  allowNavigationWhenRegistered?: boolean; // New prop to allow navigation when registered
  utm?: string; // UTM parameter to track campaign source
}

export default function JoinButton({
  isRegistered,
  hackathonId,
  customLink,
  customText,
  className,
  variant = "red",
  showChatWhenRegistered = false,
  allowNavigationWhenRegistered = false,
  utm = ""
}: JoinButtonProps) {
  
  const getButtonText = () => {
    if (isRegistered) {
      if (showChatWhenRegistered) {
        return "Join the Hackathon Chat";
      }
      return "You're In";
    }
    return customText ?? "Join now";
  };

  const getButtonHref = () => {
    if (isRegistered) {
      if (showChatWhenRegistered) {
        return "https://t.me/avalancheacademy";
      }
      if (allowNavigationWhenRegistered) {
        if (customLink) {
          return customLink;
        }
        const baseUrl = `/hackathons/registration-form?hackathon=${hackathonId}`;
        return utm ? `${baseUrl}&utm=${utm}` : baseUrl;
      }
      return "#";
    }
    if (customLink) {
      return customLink;
    }
    const baseUrl = `/hackathons/registration-form?hackathon=${hackathonId}`;
    return utm ? `${baseUrl}&utm=${utm}` : baseUrl;
  };

  const getButtonTarget = () => {
    if (isRegistered) {
      if (showChatWhenRegistered) {
        return "_blank";
      }
      if (allowNavigationWhenRegistered) {
        return customLink ? "_blank" : "_self";
      }
      return "_self";
    }
    return customLink ? "_blank" : "_self";
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isRegistered && !showChatWhenRegistered && !allowNavigationWhenRegistered) {
      e.preventDefault();
    }
  };

  return (
    <Button
      asChild
      variant={variant}
      className={className}
    >
      <Link
        href={getButtonHref()}
        target={getButtonTarget()}
        onClick={handleClick}
      >
        {getButtonText()}
      </Link>
    </Button>
  );
} 