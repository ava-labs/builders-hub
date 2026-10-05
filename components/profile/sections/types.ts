/* The data contracts of the Projects and Referrals sections. */

export type { ProfileProjectSummary as ProfileProject } from "@/server/services/profile-summary";

export type ReferralTargetIcon = "rocket" | "trophy" | "code" | "gift";

/** a place a referral link can point to (GET /api/profile/summary referralTargets) */
export interface ReferralTarget {
  /** stable key, for lists and to match the links the user has */
  key: string;
  /** the label, e.g. "Builder Hub Sign Up" */
  label: string;
  detail?: string;
  /** target_type, target_id and destination_url for POST /api/referrals */
  targetType: string;
  targetId: string | null;
  destinationUrl: string;
  icon: ReferralTargetIcon;
}

/** a referral link the user has */
export interface ReferralLink {
  id: string;
  /** the share URL, e.g. https://build.avax.network/?ref=ABC */
  shareUrl: string;
  signups: number;
  targetType: string;
  targetId: string | null;
  /** the label of the matching target */
  targetLabel: string;
  targetIcon: ReferralTargetIcon;
}
