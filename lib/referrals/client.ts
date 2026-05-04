"use client";

import { REFERRAL_COOKIE_NAME } from "@/lib/referrals/constants";

export const REFERRAL_STORAGE_KEY = "builderHubReferralAttribution";

export interface StoredReferralAttribution {
  referralCode?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  landingPath?: string;
  capturedAt: string;
}

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function writeReferralCookie(attribution: StoredReferralAttribution): void {
  const value = encodeURIComponent(JSON.stringify(attribution));
  document.cookie = `${REFERRAL_COOKIE_NAME}=${value}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
}

export function captureReferralAttributionFromUrl(): StoredReferralAttribution | null {
  if (typeof window === "undefined") return null;

  const url = new URL(window.location.href);
  const referralCode = url.searchParams.get("ref") ?? undefined;
  const utmValues = Object.fromEntries(
    UTM_KEYS.map((key) => [key, url.searchParams.get(key) ?? undefined]).filter(
      ([, value]) => Boolean(value)
    )
  );

  const hasAttribution = Boolean(referralCode) || Object.keys(utmValues).length > 0;
  if (!hasAttribution) {
    return getStoredReferralAttribution();
  }

  const attribution: StoredReferralAttribution = {
    referralCode,
    ...utmValues,
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
    return JSON.parse(stored) as StoredReferralAttribution;
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
