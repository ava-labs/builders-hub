"use client";

import { REFERRAL_COOKIE_NAME } from "@/lib/referrals/constants";

export const REFERRAL_STORAGE_KEY = "builderHubReferralAttribution";

export interface StoredReferralAttribution {
  referralCode?: string;
  landingPath?: string;
  capturedAt: string;
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
