"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Send, Trash, Check, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

  // Keep the teammate slots in sync with the picked size, but never silently
  // discard a teammate the user already typed. Growing pads with empty slots.
  // Shrinking only drops trailing EMPTY slots; if a non-empty email would be
  // cut, we keep it and raise the selected size back up to fit it (capped at
  // max) so the UI reflects the real team instead of dropping an invite.
  useEffect(() => {
    const cap = Math.max(0, (range.max ?? selectedSize) - 1);
    const slots = Math.min(cap, Math.max(0, selectedSize - 1));
    if (teammates.length === slots) return;
    if (teammates.length > slots) {
      // Drop only trailing empty slots; preserve any entered emails.
      let end = teammates.length;
      while (end > slots && teammates[end - 1].trim() === "") end--;
      if (end !== teammates.length) {
        onTeammatesChange(teammates.slice(0, end));
      }
      // A non-empty email survived past the new size — keep the picker in
      // sync so the kept teammate stays visible and gets submitted.
      const keptNonEmpty = Math.min(cap, end);
      if (keptNonEmpty + 1 > selectedSize) {
        onSizeChange(keptNonEmpty + 1);
      }
    } else {
      const next = [...teammates];
      while (next.length < slots) next.push("");
      onTeammatesChange(next);
    }
  }, [selectedSize, teammates, onTeammatesChange, onSizeChange, range.max]);

  // Pre-fetch the event referral link the first time the user expands beyond
  // solo so it's ready to copy. Re-uses an existing code for this (user,
  // hackathon) on the backend.
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
      /* noop — clipboard not available */
    }
  };

  const updateTeammate = (index: number, value: string) => {
    const next = [...teammates];
    next[index] = value;
    onTeammatesChange(next);
  };

  if (!hasTeamPicker(range)) {
    // Nothing to render — solo-only event (max === 1) or no cap (legacy).
    return null;
  }

  const max = range.max as number;
  const sizes = Array.from({ length: max }, (_, i) => i + 1);
  const teammateLabel = (i: number) =>
    sizes.length === 2
      ? lang === "es"
        ? "Email del compañero"
        : "Teammate email"
      : lang === "es"
      ? `Email del compañero ${i + 1}`
      : `Teammate ${i + 1} email`;

  return (
    <section className="space-y-4 rounded-md border border-input bg-card/50 p-4">
      <div>
        <h3 className="text-lg font-semibold">
          {lang === "es" ? "Equipo" : "Team"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {range.min > 1
            ? lang === "es"
              ? `Equipos de ${range.min} a ${max} personas.`
              : `Teams of ${range.min}–${max}.`
            : lang === "es"
            ? `Hasta ${max} personas por equipo. Tu compañero se registra al confirmar el correo.`
            : `Up to ${max} per team. Your teammate confirms by signing in via Builder Hub.`}
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
                ? lang === "es"
                  ? "Solo"
                  : "Solo"
                : s === 2
                ? lang === "es"
                  ? "Dúo"
                  : "Duo"
                : s}
            </button>
          );
        })}
      </div>

      {selectedSize > 1 && (
        <div className="space-y-3 pt-2">
          {teammates.map((email, i) => (
            <div key={i} className="space-y-1">
              <label className="text-sm font-medium" htmlFor={`teammate-${i}`}>
                {teammateLabel(i)}
              </label>
              <Input
                id={`teammate-${i}`}
                type="email"
                inputMode="email"
                autoComplete="off"
                placeholder="teammate@example.com"
                value={email}
                onChange={(e) => updateTeammate(i, e.target.value)}
              />
            </div>
          ))}

          <div className="rounded-md border border-dashed border-input p-3 text-sm">
            <p className="font-medium mb-2">
              {lang === "es"
                ? "Tu compañero aún no tiene cuenta?"
                : "Teammate doesn't have an account yet?"}
            </p>
            <p className="text-muted-foreground mb-3">
              {lang === "es"
                ? "Comparte este enlace para que se registren en el evento. Cuando inicien sesión, podrás verlos como confirmados."
                : "Share this link so they can sign up for this event. They'll show as confirmed once they sign in."}
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
                    {copied
                      ? lang === "es"
                        ? "Copiado"
                        : "Copied"
                      : lang === "es"
                      ? "Copiar"
                      : "Copy"}
                  </span>
                </Button>
              </div>
            ) : linkError ? (
              <p className="text-sm text-red-500">{linkError}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {lang === "es" ? "Generando enlace…" : "Generating link…"}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
