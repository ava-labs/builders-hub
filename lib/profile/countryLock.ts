import { prisma } from "@/prisma/prisma";

export const COUNTRY_LOCKED_MESSAGE =
  "Country is locked after your first registration. Contact support to change it.";

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

export async function hasUserRegistered(userId: string): Promise<boolean> {
  const row = await prisma.registerForm.findFirst({
    where: { user: { id: userId } },
    select: { id: true },
  });
  return row !== null;
}

export async function isCountryLockedForProfile(
  userId: string,
  currentCountry: string | null | undefined,
  attemptedCountry: string | null | undefined,
): Promise<boolean> {
  if (!isCountryChange(currentCountry, attemptedCountry)) return false;
  return hasUserRegistered(userId);
}
