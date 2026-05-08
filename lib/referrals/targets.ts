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
  {
    key: "grant-retro9000-returning",
    group: "grant",
    label: "Retro9000 Returning",
    detail: "Active grant application",
    targetType: "grant_application",
    targetId: "retro9000-returning",
    destinationUrl: "/grants/retro9000returning",
  },
];

export function getGrantReferralTarget(targetId: string | null | undefined) {
  return ACTIVE_GRANT_TARGETS.find((target) => target.targetId === targetId) ?? null;
}
