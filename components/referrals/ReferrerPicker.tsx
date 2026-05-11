"use client";

import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  OTHER_TEAM_CLIENT_VALUE,
  OTHER_TEAM_LABEL,
  REFERRAL_TEAM_LABELS,
  isOtherTeam,
  isReferralTeamId,
} from "@/lib/referrals/team-labels";

export interface ReferrerPickerValue {
  teamId: string | null;
  teamIdOther: string | null;
  userId: string | null;
}

export interface ReferrerPickerLockedDisplay {
  teamLabel: string;
  userName?: string | null;
}

interface TeamMember {
  id: string;
  name: string | null;
}

export interface ReferrerPickerProps {
  value: ReferrerPickerValue;
  onChange: (next: ReferrerPickerValue) => void;
  lockedDisplay?: ReferrerPickerLockedDisplay | null;
  loading?: boolean;
  disabled?: boolean;
}

export const EMPTY_REFERRER: ReferrerPickerValue = {
  teamId: null,
  teamIdOther: null,
  userId: null,
};

const TEAM_NONE_VALUE = "__none__";
const USER_NONE_VALUE = "__no_user__";

const TEAM_OPTIONS: Array<{ value: string; label: string }> = [
  ...Object.entries(REFERRAL_TEAM_LABELS).map(([value, label]) => ({ value, label })),
  { value: OTHER_TEAM_CLIENT_VALUE, label: OTHER_TEAM_LABEL },
];

export function ReferrerPicker({
  value,
  onChange,
  lockedDisplay,
  loading,
  disabled,
}: ReferrerPickerProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState<boolean>(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [memberCache, setMemberCache] = useState<Record<string, TeamMember[]>>({});

  const selectedTeamId = value.teamId;
  const showOtherInput = isOtherTeam(selectedTeamId);
  const showUserSelect = !!selectedTeamId && !showOtherInput && isReferralTeamId(selectedTeamId);

  useEffect(() => {
    if (!showUserSelect || !selectedTeamId) {
      setMembers([]);
      setMembersError(null);
      return;
    }
    if (memberCache[selectedTeamId]) {
      setMembers(memberCache[selectedTeamId]);
      setMembersError(null);
      return;
    }
    let cancelled = false;
    setMembersLoading(true);
    setMembersError(null);
    fetch(`/api/referrals/team-members?team_id=${encodeURIComponent(selectedTeamId)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setMembers([]);
          setMembersError("Couldn't load team members");
          return;
        }
        const data = (await res.json()) as { members: TeamMember[] };
        setMembers(data.members ?? []);
        setMemberCache((prev) => ({ ...prev, [selectedTeamId]: data.members ?? [] }));
      })
      .catch(() => {
        if (!cancelled) {
          setMembers([]);
          setMembersError("Couldn't load team members");
        }
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTeamId, showUserSelect, memberCache]);

  const userSelectValue = useMemo(() => {
    if (!showUserSelect) return USER_NONE_VALUE;
    return value.userId ?? USER_NONE_VALUE;
  }, [showUserSelect, value.userId]);

  if (lockedDisplay) {
    return (
      <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
        Referred by:{" "}
        <strong>{lockedDisplay.teamLabel}</strong>
        {lockedDisplay.userName ? <> · {lockedDisplay.userName}</> : null}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Loading referral…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Referrer team</Label>
        <Select
          value={selectedTeamId ?? TEAM_NONE_VALUE}
          onValueChange={(next) => {
            if (next === TEAM_NONE_VALUE) {
              onChange({ teamId: null, teamIdOther: null, userId: null });
              return;
            }
            if (isOtherTeam(next)) {
              onChange({ teamId: OTHER_TEAM_CLIENT_VALUE, teamIdOther: value.teamIdOther ?? "", userId: null });
              return;
            }
            onChange({ teamId: next, teamIdOther: null, userId: null });
          }}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a team (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TEAM_NONE_VALUE}>— No team —</SelectItem>
            {TEAM_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showOtherInput && (
        <div className="space-y-2">
          <Label>Tell us who referred you</Label>
          <Input
            maxLength={100}
            placeholder="e.g. Pedro from the Lisbon hackerhouse"
            value={value.teamIdOther ?? ""}
            onChange={(e) =>
              onChange({ ...value, teamIdOther: e.target.value, userId: null })
            }
            disabled={disabled}
          />
        </div>
      )}

      {showUserSelect && (
        <div className="space-y-2">
          <Label>Specific person (optional)</Label>
          <Select
            value={userSelectValue}
            onValueChange={(next) => {
              onChange({
                ...value,
                userId: next === USER_NONE_VALUE ? null : next,
              });
            }}
            disabled={disabled || membersLoading}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={membersLoading ? "Loading…" : "No specific person"}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={USER_NONE_VALUE}>No specific person</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name?.trim() || "Unnamed member"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {membersError && (
            <p className="text-xs text-destructive">{membersError}</p>
          )}
        </div>
      )}
    </div>
  );
}
