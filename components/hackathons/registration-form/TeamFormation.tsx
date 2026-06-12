"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmailListInput } from "@/components/common/EmailListInput";
import { createReferralLink } from "@/lib/referrals/client";
import { type EventsLang, t } from "@/lib/events/i18n";
import {
  getTeamSizeRange,
  hasTeamPicker,
  type TeamSizeRange,
} from "@/lib/hackathons/teamSizeDefaults";

interface Props {
  hackathonId: string;
  hackathon: { team_size_min?: number; team_size_max?: number } | undefined;
  selectedSize: number;
  onSizeChange: (size: number) => void;
  teammates: string[];
  onTeammatesChange: (emails: string[]) => void;
  inviterEmail?: string;
  lang: EventsLang;
}

export function TeamFormation({
  hackathonId,
  hackathon,
  selectedSize,
  onSizeChange,
  teammates,
  onTeammatesChange,
  inviterEmail,
  lang,
}: Props) {
  const range: TeamSizeRange = useMemo(() => getTeamSizeRange(hackathon), [hackathon]);
  const [referralLink, setReferralLink] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Drafts saved before the tag input existed may still carry empty slots.
  const emails = useMemo(
    () => teammates.filter((email) => email.trim().length > 0),
    [teammates],
  );

  useEffect(() => {
    const cap = Math.max(0, (range.max ?? selectedSize) - 1);
    if (emails.length > cap) {
      onTeammatesChange(emails.slice(0, cap));
      return;
    }
    if (emails.length + 1 > selectedSize) {
      onSizeChange(Math.min(range.max ?? emails.length + 1, emails.length + 1));
    }
  }, [emails, selectedSize, onTeammatesChange, onSizeChange, range.max]);

  useEffect(() => {
    if (selectedSize <= 1 || referralLink) return;
    let cancelled = false;
    createReferralLink({
      targetType: "hackathon_registration",
      targetId: hackathonId,
      destinationUrl: `/events/registration-form?event=${hackathonId}`,
    })
      .then((res) => {
        if (!cancelled) setReferralLink(res.shareUrl);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Could not generate invite link";
          setLinkError(msg);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSize, hackathonId, referralLink]);

  const handleCopy = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
    }
  };

  if (!hasTeamPicker(range)) {
    return null;
  }

  const max = range.max as number;
  const sizes = Array.from({ length: max }, (_, i) => i + 1);

  return (
    <section className="space-y-4 rounded-md border border-input bg-card/50 p-4">
      <div>
        <h3 className="text-lg font-semibold">{t(lang, "reg.team.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {range.min > 1
            ? t(lang, "reg.team.sizeRange", { min: range.min, max })
            : t(lang, "reg.team.sizeUpTo", { max })}
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Team size">
        {sizes.map((s) => {
          const disabled = s < range.min;
          const isSelected = selectedSize === s;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onSizeChange(s)}
              className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                isSelected
                  ? "bg-red-600 text-white border-red-500"
                  : "bg-background text-foreground border-input hover:bg-secondary"
              } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              {s === 1
                ? t(lang, "reg.team.solo")
                : s === 2
                ? t(lang, "reg.team.duo")
                : s}
            </button>
          );
        })}
      </div>

      {selectedSize > 1 && (
        <div className="space-y-3 pt-2">
          <EmailListInput
            value={emails}
            onChange={onTeammatesChange}
            label={t(lang, "reg.team.emailsLabel")}
            placeholder={t(lang, "reg.team.emailsPlaceholder")}
          />

          <div className="rounded-md border border-dashed border-input p-3 text-sm">
            <p className="font-medium mb-2">{t(lang, "reg.team.inviteTitle")}</p>
            <p className="text-muted-foreground mb-3">
              {t(lang, "reg.team.inviteDesc")}
            </p>
            {referralLink ? (
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={referralLink}
                  className="font-mono text-xs"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  <span className="ml-1">
                    {copied ? t(lang, "reg.team.copied") : t(lang, "reg.team.copy")}
                  </span>
                </Button>
              </div>
            ) : linkError ? (
              <p className="text-sm text-red-500">{linkError}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t(lang, "reg.team.generatingLink")}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
