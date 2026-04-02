"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SubmissionRow, EvaluationData, Verdict } from "./types";

const VERDICT_SCORES: Record<string, number> = {
  top: 5, strong: 4, maybe: 3, weak: 2, reject: 1,
};
const SCORE_TO_VERDICT: Record<number, Verdict> = {
  5: "top", 4: "strong", 3: "maybe", 2: "weak", 1: "reject",
};

interface Props {
  rows: SubmissionRow[];
  hackathonTitle: string;
  getEvaluations: (formDataId: string, original: EvaluationData[]) => EvaluationData[];
  getCurrentStage: (formDataId: string, original: number) => number;
  onClose: () => void;
}

export function ExportModal({ rows, hackathonTitle, getEvaluations, getCurrentStage, onClose }: Props) {
  const [includeMembers, setIncludeMembers] = useState(true);
  const [includeReferral, setIncludeReferral] = useState(false);
  const [includeStages, setIncludeStages] = useState(true);

  const maxMembers = Math.max(...rows.map((r) => r.memberApplications.length), 1);
  const maxStage = rows.length > 0
    ? Math.max(...rows.map((r) => getCurrentStage(r.formDataId, r.currentStage)))
    : 0;

  const handleDownload = () => {
    const headers: string[] = [
      "Project", "Applicant", "Email", "Area", "Country", "Current Stage", "Team Size",
    ];

    if (includeMembers) {
      for (let i = 0; i < maxMembers; i++) {
        headers.push(`Member ${i + 1} Email`, `Member ${i + 1} Name`);
      }
    }

    if (includeReferral) {
      for (let i = 0; i < maxMembers; i++) {
        headers.push(`Member ${i + 1} Referrer`, `Member ${i + 1} Referrer Handle`);
      }
    }

    if (includeStages) {
      for (let s = 0; s <= maxStage; s++) {
        headers.push(`Stage ${s} Verdict`, `Stage ${s} Score`);
      }
    }

    const csvRows = rows.map((row) => {
      const evals = getEvaluations(row.formDataId, row.evaluations);
      const cs = getCurrentStage(row.formDataId, row.currentStage);

      const cols: string[] = [
        row.projectName,
        row.applicantName,
        row.applicantEmail,
        row.areaOfFocus ?? "",
        row.country,
        `Stage ${cs}`,
        String(row.project?.members.length ?? 0),
      ];

      if (includeMembers) {
        for (let i = 0; i < maxMembers; i++) {
          const m = row.memberApplications[i];
          cols.push(m?.email ?? "", m?.name ?? "");
        }
      }

      if (includeReferral) {
        for (let i = 0; i < maxMembers; i++) {
          const m = row.memberApplications[i];
          cols.push(
            String(m?.data?.referrer_name ?? ""),
            String(m?.data?.referrer_handle ?? ""),
          );
        }
      }

      if (includeStages) {
        for (let s = 0; s <= maxStage; s++) {
          const stageEvals = evals.filter((e) => e.stage === s);
          if (stageEvals.length === 0) {
            cols.push("", "");
          } else {
            const avg = stageEvals.reduce((sum, e) => sum + (VERDICT_SCORES[e.verdict] ?? 0), 0) / stageEvals.length;
            const consensus = SCORE_TO_VERDICT[Math.round(avg)] ?? "";
            const withScores = stageEvals.filter((e) => e.scoreOverall !== null);
            const avgScore = withScores.length > 0
              ? (withScores.reduce((sum, e) => sum + (e.scoreOverall ?? 0), 0) / withScores.length).toFixed(1)
              : "";
            cols.push(consensus, avgScore);
          }
        }
      }

      return cols.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });

    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const slug = hackathonTitle.replace(/[^a-zA-Z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    a.download = `${slug}-${new Date().toISOString().split("T")[0]}-evaluate-export.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
            Export Projects
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium">Include</p>

          <div className="space-y-3">
            <label className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-300">
              <input type="checkbox" checked disabled className="rounded border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 w-4 h-4" />
              Project info
              <span className="text-xs text-zinc-500 ml-auto">name, area, country, stage</span>
            </label>

            <label className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeMembers}
                onChange={(e) => setIncludeMembers(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 w-4 h-4"
              />
              Team members
              <span className="text-xs text-zinc-500 ml-auto">email, name per member</span>
            </label>

            <label className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeReferral}
                onChange={(e) => setIncludeReferral(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 w-4 h-4"
              />
              Referral info
              <span className="text-xs text-zinc-500 ml-auto">referrer per member</span>
            </label>

            <label className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeStages}
                onChange={(e) => setIncludeStages(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 w-4 h-4"
              />
              Stage evaluations
              <span className="text-xs text-zinc-500 ml-auto">verdict + score (Stage 0{maxStage > 0 ? `–${maxStage}` : ""})</span>
            </label>
          </div>

          <p className="text-xs text-zinc-500">
            Exporting <span className="text-zinc-900 dark:text-white font-bold">{rows.length}</span> projects
          </p>

          <div className="flex items-center gap-3 pt-1">
            <Button onClick={handleDownload} disabled={rows.length === 0}>
              Download CSV
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
