"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { FormLabel } from "@/components/ui/form";
import { EventsLang } from "@/lib/events/i18n";

export type TeamPartnerMode = "solo" | "duo";

export interface TeamPartnerValue {
  mode: TeamPartnerMode;
  /** Teammate handle (any free-form identifier — email / GitHub / Telegram) or null when Solo. */
  partnerHandle: string | null;
}

interface TeamPartnerInputProps {
  hackathonId: string;
  lang?: EventsLang;
  /** Authenticated user's email — kept just to avoid letting someone invite themselves. */
  currentUserEmail?: string | null;
  /** When defined, only Solo (1) and Duo (2) are valid modes. Otherwise both are always shown. */
  teamSizeMax?: number;
  /** Optional controlled value. When omitted, the component manages state internally and
   * the parent reads the result via `onChange`. */
  value?: TeamPartnerValue;
  onChange?: (value: TeamPartnerValue) => void;
}

/**
 * Pre-project team picker for registration. Unlike `components/.../project-submission/Members.tsx`
 * (which assumes a Project row already exists and talks to `/api/project/[id]/members`), this
 * component runs *before* registration submits — there's no project yet. Result is collected
 * inline and POSTed alongside the RegisterForm payload; the server upserts the Member
 * placeholder when the project is later created.
 */
export default function TeamPartnerInput({
  lang = "en",
  currentUserEmail,
  teamSizeMax,
  value,
  onChange,
}: TeamPartnerInputProps) {
  const [internal, setInternal] = useState<TeamPartnerValue>({
    mode: "solo",
    partnerHandle: null,
  });
  const current = value ?? internal;

  const update = (next: TeamPartnerValue) => {
    if (value === undefined) setInternal(next);
    onChange?.(next);
  };

  const handleModeChange = (next: TeamPartnerMode) => {
    update({ mode: next, partnerHandle: next === "solo" ? null : current.partnerHandle ?? "" });
  };

  const handleHandleChange = (raw: string) => {
    update({ mode: "duo", partnerHandle: raw });
  };

  // teamSizeMax === 1 → solo-only (don't show Duo). Otherwise show both modes.
  const duoAllowed = teamSizeMax !== 1;

  const trimmedSelf = currentUserEmail?.trim().toLowerCase() ?? "";
  const trimmedPartner = (current.partnerHandle ?? "").trim().toLowerCase();
  const selfReferral = current.mode === "duo" && trimmedPartner.length > 0 && trimmedPartner === trimmedSelf;

  return (
    <div className="mt-6 space-y-3">
      <FormLabel className="text-base font-medium">
        {lang === "es" ? "¿Vas Solo o en Duo?" : "Going Solo or with a Partner?"}
      </FormLabel>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => handleModeChange("solo")}
          className={`px-4 py-2 rounded-md border cursor-pointer ${
            current.mode === "solo"
              ? "bg-red-500 text-white border-red-500"
              : "bg-transparent border-zinc-400 hover:border-red-400"
          }`}
        >
          {lang === "es" ? "Solo" : "Solo"}
        </button>
        {duoAllowed && (
          <button
            type="button"
            onClick={() => handleModeChange("duo")}
            className={`px-4 py-2 rounded-md border cursor-pointer ${
              current.mode === "duo"
                ? "bg-red-500 text-white border-red-500"
                : "bg-transparent border-zinc-400 hover:border-red-400"
            }`}
          >
            {lang === "es" ? "Duo" : "Duo"}
          </button>
        )}
      </div>

      {current.mode === "duo" && (
        <div className="space-y-2">
          <FormLabel className="text-sm font-normal">
            {lang === "es"
              ? "Email o handle de tu compañero/a"
              : "Teammate email or handle"}
          </FormLabel>
          <Input
            value={current.partnerHandle ?? ""}
            onChange={(e) => handleHandleChange(e.target.value)}
            placeholder={
              lang === "es"
                ? "teammate@email.com o @github_handle"
                : "teammate@email.com or @github_handle"
            }
            className="bg-transparent placeholder-zinc-600"
          />
          {selfReferral && (
            <p className="text-sm text-red-500">
              {lang === "es"
                ? "No puedes invitarte a ti mismo."
                : "You can't invite yourself."}
            </p>
          )}
          <p className="text-xs text-zinc-500">
            {lang === "es"
              ? "Tu compañero/a recibirá una invitación cuando inicie sesión en Builder Hub. Si no confirma antes del cierre del registro, el equipo se convierte en Solo."
              : "Your teammate gets an invite when they sign in to Builder Hub. If they don't confirm before registration closes, the team auto-converts to Solo."}
          </p>
        </div>
      )}
    </div>
  );
}
