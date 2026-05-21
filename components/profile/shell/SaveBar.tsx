"use client";

import * as React from "react";
import { Check } from "lucide-react";

interface Props {
  visible: boolean;
  saving?: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

export function SaveBar({ visible, saving, onSave, onDiscard }: Props) {
  return (
    <div className={`pr-savebar${visible ? "" : " pr-hidden"}`} role="status" aria-live="polite">
      <span className="pr-dot" aria-hidden />
      <div className="pr-msg">
        You have <b>unsaved changes</b> — they'll be lost if you leave.
      </div>
      <button
        type="button"
        className="pr-btn pr-btn--ghost pr-btn--sm"
        onClick={onDiscard}
        disabled={saving}
      >
        Discard
      </button>
      <button
        type="button"
        className="pr-btn pr-btn--primary pr-btn--sm"
        onClick={onSave}
        disabled={saving}
      >
        <Check size={14} /> {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}
