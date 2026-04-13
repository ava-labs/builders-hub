"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { STAGE_BADGE_COLORS, STAGE_FULL_LABELS } from "./colors";

interface Props {
  formDataId: string;
  currentStage: number;
  isDevrel: boolean;
  onStageAdvanced: (formDataId: string, newStage: number) => void;
}

export function AdvanceStageControls({
  formDataId,
  currentStage,
  isDevrel,
  onStageAdvanced,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isDevrel) return null;

  const handleAdvance = async (newStage: number) => {
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/evaluate/advance-stage", {
        method: "POST",
        body: { formDataId, stage: newStage },
      });
      onStageAdvanced(formDataId, newStage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/50">
      <span className="text-xs text-zinc-500">Stage Control:</span>
      <div className="flex gap-1.5">
        {[0, 1, 2, 3, 4].map((s) => (
          <button
            key={s}
            onClick={() => handleAdvance(s)}
            disabled={saving || s === currentStage}
            className={`px-2.5 py-1 text-xs rounded-md border cursor-pointer transition-all duration-200 ${
              s === currentStage
                ? `${STAGE_BADGE_COLORS[s] ?? STAGE_BADGE_COLORS[0]} font-bold ring-1 ring-offset-1 ring-offset-white dark:ring-offset-zinc-900`
                : "border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:border-zinc-400 dark:hover:border-zinc-500"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {s === 0 ? "0" : `S${s}`}
          </button>
        ))}
      </div>
      <Badge variant="outline" className={`text-xs ${STAGE_BADGE_COLORS[currentStage] ?? STAGE_BADGE_COLORS[0]}`}>
        {STAGE_FULL_LABELS[currentStage] ?? `Stage ${currentStage}`}
      </Badge>
      {saving && <span className="text-xs text-zinc-500">Saving...</span>}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
