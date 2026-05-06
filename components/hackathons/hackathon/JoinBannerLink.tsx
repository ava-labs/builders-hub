"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { captureReferralAttributionFromUrl } from "@/lib/referrals/client";

interface JoinBannerLinkProps {
  isRegistered: boolean;
  hackathonId: string;
  customLink?: string;
  bannerSrc: string;
  altText?: string;
  utm?: string; // UTM parameter to track campaign source
}

export default function JoinBannerLink({
  isRegistered,
  hackathonId,
  customLink,
  bannerSrc,
  altText = "Hackathon background",
  utm = ""
}: JoinBannerLinkProps) {
  const [currentReferralCode, setCurrentReferralCode] = useState("");

  useEffect(() => {
    const url = new URL(window.location.href);
    const referralCode = url.searchParams.get("ref") ?? "";
    if (referralCode) {
      captureReferralAttributionFromUrl();
      setCurrentReferralCode(referralCode);
    }
  }, []);

  const appendTrackingParams = (baseUrl: string) => {
    const params = new URLSearchParams();
    if (utm) params.set("utm", utm);
    if (currentReferralCode) params.set("ref", currentReferralCode);
    const query = params.toString();
    return query ? `${baseUrl}&${query}` : baseUrl;
  };

  const getHref = () => {
    // Always allow navigation to registration form (even if registered, so they can modify)
    if (customLink) {
      return customLink;
    }
    const baseUrl = `/events/registration-form?event=${hackathonId}`;
    return appendTrackingParams(baseUrl);
  };

  const getTarget = () => {
    return customLink ? "_blank" : "_self";
  };

  return (
    <Link
      href={getHref()}
      target={getTarget()}
    >
      <Image
        src={bannerSrc}
        alt={altText}
        width={1270}
        height={760}
        className="w-full h-full"
        priority
      />
    </Link>
  );
}
