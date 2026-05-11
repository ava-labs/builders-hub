"use client";

import { useEffect, useMemo } from "react";
import {
  captureReferralAttributionFromUrl,
  getStoredReferralAttribution,
} from "@/lib/referrals/client";
import {
  formatTeamLabel,
  isOtherTeam,
  OTHER_TEAM_CLIENT_VALUE,
} from "@/lib/referrals/team-labels";
import { useReferrerAutoFill } from "@/hooks/use-referrer-auto-fill";
import {
  EMPTY_REFERRER,
  ReferrerPicker,
  type ReferrerPickerValue,
} from "./ReferrerPicker";

export interface ReferralFormSectionProps {
  value: ReferrerPickerValue;
  onChange: (next: ReferrerPickerValue) => void;
  // The same target_type / target_id pair that the API route will pass to
  // extractAndRecordReferral. Only used here for symmetry — picker UI is
  // target-agnostic, but exposing the props makes future scoped behavior
  // (e.g. hiding for a target_type) trivial.
  target?: { type: string; id?: string | null };
  title?: string;
  description?: string;
  className?: string;
}

// Drop-in section for any submission form. Wraps:
//   - URL ?ref=CODE auto-fill (resolves to team + user, locks picker)
//   - Existing localStorage / cookie capture (still side-effecting via
//     captureReferralAttributionFromUrl so the Builder Hub signup flow
//     stays attributed if the visitor lands on the form via a code)
//   - The team / user picker UI
//
// `value` / `onChange` are the only required props — wire them through your
// React Hook Form watch / setValue (or plain useState).
export function ReferralFormSection({
  value,
  onChange,
  title = "Referral",
  description = "Were you referred by a Team1 ambassador or someone on the Avalanche team? (Optional)",
  className,
}: ReferralFormSectionProps) {
  // Side-effect: keeps the existing 30-day cookie/localStorage flow alive
  // for code-based attribution even if the visitor clicks away. Mirrors
  // what every form on the branch already does.
  useEffect(() => {
    captureReferralAttributionFromUrl();
  }, []);

  const { resolved, loading, locked } = useReferrerAutoFill();

  const lockedDisplay = useMemo(() => {
    if (!locked || !resolved) return null;
    const teamLabel = formatTeamLabel(resolved.teamId) ?? "Community";
    return { teamLabel, userName: resolved.userName ?? null };
  }, [locked, resolved]);

  return (
    <section className={className}>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="mt-3">
        <ReferrerPicker
          value={value}
          onChange={onChange}
          lockedDisplay={lockedDisplay}
          loading={loading}
          disabled={locked}
        />
      </div>
    </section>
  );
}

// Builds the `referral_attribution` payload your API route should receive.
// Pass it inside the form body next to whatever Zod-validated fields you
// already send. URL code wins (handled server-side too); manual fields are
// only included when the visitor actually picked something.
export function buildReferralAttributionPayload(picker: ReferrerPickerValue): {
  referral_attribution: {
    referralCode: string | null;
    landingPath: string | null;
    manualReferrer: {
      teamId: string;
      teamIdOther: string | null;
      userId: string | null;
    } | null;
  } | null;
} {
  const urlAttribution =
    typeof window !== "undefined"
      ? captureReferralAttributionFromUrl() ?? getStoredReferralAttribution()
      : null;

  const hasManualSelection =
    !!picker.teamId &&
    (!isOtherTeam(picker.teamId) ||
      (picker.teamIdOther ?? "").trim().length > 0);

  if (!urlAttribution && !hasManualSelection) {
    return { referral_attribution: null };
  }

  const manual = hasManualSelection
    ? {
        teamId: picker.teamId === OTHER_TEAM_CLIENT_VALUE ? OTHER_TEAM_CLIENT_VALUE : (picker.teamId as string),
        teamIdOther: isOtherTeam(picker.teamId) ? (picker.teamIdOther ?? "").trim() : null,
        userId: isOtherTeam(picker.teamId) ? null : picker.userId,
      }
    : null;

  return {
    referral_attribution: {
      referralCode: urlAttribution?.referralCode ?? null,
      landingPath: urlAttribution?.landingPath ?? null,
      manualReferrer: manual,
    },
  };
}
