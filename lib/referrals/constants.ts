export const REFERRAL_COOKIE_NAME = "bh_referral";

export const REFERRAL_TARGET_TYPES = [
  "bh_signup",
  "hackathon_registration",
  "build_games_application",
  "grant_application",
] as const;

export type ReferralTargetType = (typeof REFERRAL_TARGET_TYPES)[number];
