"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

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
  
  const getHref = () => {
    // Always allow navigation to registration form (even if registered, so they can modify)
    if (customLink) {
      return customLink;
    }
    const baseUrl = `/hackathons/registration-form?hackathon=${hackathonId}`;
    return utm ? `${baseUrl}&utm=${utm}` : baseUrl;
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