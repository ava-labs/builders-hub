import { z } from "zod";

// Reusable Zod block any submission form can `.merge()` into its body
// schema. The shape mirrors `ReferralAttributionPayload` in
// `server/services/referrals.ts` so route handlers can pass `body` straight
// into `extractAndRecordReferral` without re-parsing.
//
// Server-side validation of `teamId` (curated id vs. "other"/"none") and
// the `userId` ↔ `User.team_id` cross-check happen inside
// `recordReferralAttribution`. Forms only enforce shape here.

export const manualReferrerSchema = z
  .object({
    teamId: z.string().min(1).max(64),
    teamIdOther: z.string().trim().min(1).max(100).nullish(),
    userId: z.string().min(1).max(64).nullish(),
  })
  .nullish();

export const referralAttributionPayloadSchema = z
  .object({
    referralCode: z.string().min(1).max(64).nullish(),
    landingPath: z.string().max(2048).nullish(),
    manualReferrer: manualReferrerSchema,
  })
  .nullish();

export const referralAttributionSchema = z.object({
  referral_attribution: referralAttributionPayloadSchema,
});

export type ManualReferrerPayload = z.infer<typeof manualReferrerSchema>;
export type ReferralAttributionPayloadInput = z.infer<typeof referralAttributionPayloadSchema>;
