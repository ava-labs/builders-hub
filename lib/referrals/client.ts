"use client";

import { useEffect, useState } from "react";
import { REFERRAL_COOKIE_NAME } from "@/lib/referrals/constants";
import type { ReferralTargetType } from "@/lib/referrals/constants";

export const REFERRAL_STORAGE_KEY = "builderHubReferralAttribution";

export interface StoredReferralAttribution {
  referralCode?: string;
  landingPath?: string;
  capturedAt: string;
}

export interface ReferralLinkResponse {
  id: string;
  code: string;
  target_type: string;
  target_id: string | null;
  destination_url: string;
  created_at: string | Date;
  shareUrl: string;
}

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const ATTRIBUTION_MAX_AGE_MS = COOKIE_MAX_AGE_SECONDS * 1000;

function writeReferralCookie(attribution: StoredReferralAttribution): void {
  const value = encodeURIComponent(JSON.stringify(attribution));
  document.cookie = `${REFERRAL_COOKIE_NAME}=${value}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
}

export function captureReferralAttributionFromUrl(): StoredReferralAttribution | null {
  if (typeof window === "undefined") return null;

  const url = new URL(window.location.href);
  const referralCode = url.searchParams.get("ref") ?? undefined;

  if (!referralCode) {
    return getStoredReferralAttribution();
  }

  const attribution: StoredReferralAttribution = {
    referralCode,
    landingPath: `${url.pathname}${url.search}`,
    capturedAt: new Date().toISOString(),
  };

  localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(attribution));
  writeReferralCookie(attribution);
  return attribution;
}

export function getStoredReferralAttribution(): StoredReferralAttribution | null {
  if (typeof window === "undefined") return null;

  const stored = localStorage.getItem(REFERRAL_STORAGE_KEY);
  if (!stored) return null;

  try {
    const attribution = JSON.parse(stored) as StoredReferralAttribution;
    const capturedAtMs = Date.parse(attribution.capturedAt);

    if (!Number.isFinite(capturedAtMs) || Date.now() - capturedAtMs > ATTRIBUTION_MAX_AGE_MS) {
      clearStoredReferralAttribution();
      return null;
    }

    return attribution;
  } catch {
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
    return null;
  }
}

export function clearStoredReferralAttribution(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(REFERRAL_STORAGE_KEY);
  document.cookie = `${REFERRAL_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
}

export function useCurrentReferralCode(): string {
  const [referralCode, setReferralCode] = useState("");

  useEffect(() => {
    const url = new URL(window.location.href);
    const currentReferralCode = url.searchParams.get("ref") ?? "";
    if (!currentReferralCode) return;

    captureReferralAttributionFromUrl();
    setReferralCode(currentReferralCode);
  }, []);

  return referralCode;
}

export function appendReferralTrackingParams(
  baseUrl: string,
  {
    referralCode,
    utm,
  }: {
    referralCode?: string | null;
    utm?: string | null;
  } = {}
): string {
  const origin = typeof window === "undefined" ? "https://build.avax.network" : window.location.origin;
  const url = new URL(baseUrl, origin);

  if (utm) url.searchParams.set("utm", utm);
  if (referralCode) url.searchParams.set("ref", referralCode);

  if (/^https?:\/\//i.test(baseUrl)) {
    return url.toString();
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export async function createReferralLink({
  targetType,
  targetId,
  destinationUrl,
}: {
  targetType: ReferralTargetType;
  targetId?: string | null;
  destinationUrl?: string | null;
}): Promise<ReferralLinkResponse> {
  const response = await fetch("/api/referrals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetType, targetId, destinationUrl }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Failed to create referral link");
  }

  return payload as ReferralLinkResponse;
}
