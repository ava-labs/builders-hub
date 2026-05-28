"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  appendReferralTrackingParams,
  useCurrentReferralCode,
} from "@/lib/referrals/client";

interface JoinBannerLinkProps {
  isRegistered: boolean;
  hackathonId: string;
  customLink?: string;
  bannerSrc: string;
  altText?: string;
}

export default function JoinBannerLink({
  isRegistered,
  hackathonId,
  customLink,
  bannerSrc,
  altText = "Hackathon background",
}: JoinBannerLinkProps) {
  const currentReferralCode = useCurrentReferralCode();

  const getHref = () => {
    // Always allow navigation to registration form (even if registered, so they can modify)
    if (customLink) {
      return customLink;
    }
    const baseUrl = `/events/registration-form?event=${hackathonId}`;
    return appendReferralTrackingParams(baseUrl, { referralCode: currentReferralCode });
  };

  const getTarget = () => {
    return customLink ? "_blank" : "_self";
  };

  return (
    <Link
      href={getHref()}
      target={getTarget()}
    >
      <img
        src={bannerSrc}
        alt={altText}
        className="w-full h-full object-cover"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    </Link>
  );
}
