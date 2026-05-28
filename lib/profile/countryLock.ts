import { prisma } from "@/prisma/prisma";

/**
 * The country lock is part of the SPEEDRUN spec: "Country (locked after
 * registration — some events are country-specific, so this can't be changed
 * later)". The lock fires once a user has at least one RegisterForm row;
 * before that, the field is freely editable from /profile.
 */
export const COUNTRY_LOCKED_MESSAGE =
  "Country is locked after your first registration. Contact support to change it.";

/**
 * Returns true when the attempted country differs from the user's currently
 * stored country. Whitespace-insensitive. A missing current or attempted
 * value is treated as no-op (no change to compare against).
 */
export function isCountryChange(
  currentCountry: string | null | undefined,
  attemptedCountry: string | null | undefined,
): boolean {
  const current = currentCountry?.trim();
  const attempted = attemptedCountry?.trim();
  if (!current) return false;
  if (!attempted) return false;
  return current !== attempted;
}

/**
 * True when the user has registered for at least one hackathon. This is the
 * spec's "after registration" gate — the country lock only activates once
 * this returns true.
 */
export async function hasUserRegistered(userId: string): Promise<boolean> {
  const row = await prisma.registerForm.findFirst({
    where: { user: { id: userId } },
    select: { id: true },
  });
  return row !== null;
}

/**
 * Spec-correct country-lock check for the profile-edit path: enforce the
 * immutability rule only after the user has registered. Returns true when
 * the change must be rejected.
 */
export async function isCountryLockedForProfile(
  userId: string,
  currentCountry: string | null | undefined,
  attemptedCountry: string | null | undefined,
): Promise<boolean> {
  if (!isCountryChange(currentCountry, attemptedCountry)) return false;
  return hasUserRegistered(userId);
}
