import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Canonical email normalization — emails are stored lowercased in the DB.
// Use this at every boundary that looks up or writes User.email.
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim()
}
