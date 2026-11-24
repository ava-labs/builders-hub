import { toCsv } from "@/server/services/audits/csv";
import type { SubmissionRow, EvaluationData, Verdict } from "./types";

const VERDICT_SCORES: Record<string, number> = {
  top: 5, strong: 4, maybe: 3, weak: 2, reject: 1,
};
const SCORE_TO_VERDICT: Record<number, Verdict> = {
  5: "top", 4: "strong", 3: "maybe", 2: "weak", 1: "reject",
};

export interface EvaluateExportOptions {
  rows: SubmissionRow[];
  includeMembers: boolean;
  includeStages: boolean;
  /** the widest team: one email and name column pair per member */
  maxMembers: number;
  /** the last stage any row reached */
  maxStage: number;
  getEvaluations: (formDataId: string, original: EvaluationData[]) => EvaluationData[];
  getCurrentStage: (formDataId: string, original: number) => number;
}

/**
 * The evaluate page's export as CSV text. Project and member names are text
 * that applicants typed, so the shared writer makes the cells: it quotes
 * them and keeps a cell that starts like a formula as text.
 */
export function evaluateExportCsv({
  rows,
  includeMembers,
  includeStages,
  maxMembers,
  maxStage,
  getEvaluations,
  getCurrentStage,
}: EvaluateExportOptions): string {
  const headers: string[] = [
    "Project", "Applicant", "Email", "Area", "Country", "Current Stage", "Team Size",
  ];

  if (includeMembers) {
    for (let i = 0; i < maxMembers; i++) {
      headers.push(`Member ${i + 1} Email`, `Member ${i + 1} Name`);
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

    if (includeStages) {
      for (let s = 0; s <= maxStage; s++) {
        const stageEvals = evals.filter((e) => e.stage === s);
        if (stageEvals.length === 0) {
          cols.push("", "");
        } else {
          const avg = stageEvals.reduce((sum, e) => sum + (e.verdict ? VERDICT_SCORES[e.verdict] ?? 0 : 0), 0) / stageEvals.length;
          const consensus = SCORE_TO_VERDICT[Math.round(avg)] ?? "";
          const withScores = stageEvals.filter((e) => e.scoreOverall !== null);
          const avgScore = withScores.length > 0
            ? (withScores.reduce((sum, e) => sum + (e.scoreOverall ?? 0), 0) / withScores.length).toFixed(1)
            : "";
          cols.push(consensus, avgScore);
        }
      }
    }

    return cols;
  });

  return toCsv(headers, csvRows);
}
