"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useLoginModalTrigger } from "@/hooks/useLoginModal";
import { EventsLang, normalizeEventsLang, t } from "@/lib/events/i18n";
import {
  appendReferralTrackingParams,
  useCurrentReferralCode,
} from "@/lib/referrals/client";

interface JoinButtonProps {
  isRegistered: boolean;
  hackathonId: string;
  customLink?: string;
  customText?: string;
  className?: string;
  variant?: "red" | "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  showChatWhenRegistered?: boolean;
  allowNavigationWhenRegistered?: boolean;
  utm?: string;
  isAuthenticated?: boolean;
  /** UI language for predefined labels (defaults to 'en'). */
  lang?: EventsLang;
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
  utm = "",
  isAuthenticated = false,
  lang: langProp,
}: JoinButtonProps) {
  const lang = langProp ?? normalizeEventsLang(undefined);
  const { status } = useSession();
  const { openLoginModal } = useLoginModalTrigger();
  const currentReferralCode = useCurrentReferralCode();

  const getButtonText = () => {
    if (isRegistered) {
      if (showChatWhenRegistered) {
        return t(lang, "join.chat");
      }
      return t(lang, "join.registered");
    }
    // Back-compat: many events stored the old default "Join now" in content.
    // Treat it as "no custom text" so translation applies.
    const normalizedCustomText =
      customText && customText.trim() !== "" && customText !== "Join now"
        ? customText
        : undefined;
    return normalizedCustomText ?? t(lang, "join.default");
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
        const baseUrl = `/events/registration-form?event=${hackathonId}`;
        return appendReferralTrackingParams(baseUrl, { referralCode: currentReferralCode, utm });
      }
      return "#";
    }
    if (customLink) {
      return customLink;
    }
    const baseUrl = `/events/registration-form?event=${hackathonId}`;
    return appendReferralTrackingParams(baseUrl, { referralCode: currentReferralCode, utm });
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
    if (!isAuthenticated && status !== "authenticated" && !isRegistered) {
      e.preventDefault();
      openLoginModal(getButtonHref());
      return;
    }
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
