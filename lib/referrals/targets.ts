import type { ReferralTargetType } from "@/lib/referrals/constants";

export interface ReferralTargetPreset {
  key: string;
  group: "signup" | "event" | "grant";
  label: string;
  detail: string;
  targetType: ReferralTargetType;
  targetId: string | null;
  destinationUrl: string;
}

export const BUILDER_HUB_SIGNUP_TARGET: ReferralTargetPreset = {
  key: "signup-builder-hub",
  group: "signup",
  label: "Builder Hub Sign Up",
  detail: "Active signup link",
  targetType: "bh_signup",
  targetId: null,
  destinationUrl: "/",
};

export const ACTIVE_GRANT_TARGETS: ReferralTargetPreset[] = [
  {
    key: "grant-avalanche-research-proposals",
    group: "grant",
    label: "Call for Research Proposals",
    detail: "Active grant application",
    targetType: "grant_application",
    targetId: "avalanche-research-proposals",
    destinationUrl: "/grants/avalanche-research-proposals",
  },
];

export function getGrantReferralTarget(targetId: string | null | undefined) {
  return ACTIVE_GRANT_TARGETS.find((target) => target.targetId === targetId) ?? null;
}
