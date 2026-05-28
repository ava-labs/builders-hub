/**
 * Single source of truth for required submission fields.
 * Imported by:
 *   - isProjectComplete()      → server/services/submitProject.ts (email gate)
 *   - calcSubmissionProgress() → here (event-page status)
 *   - getAllFields()            → components/…/GeneralSecure.tsx (form progress bar)
 */

type RawProject = {
  id: string;
  project_name: string;
  short_description: string;
  full_description: string | null;
  tech_stack: string[];
  github_repository: string | null;
  demo_link: string | null;
  tracks: string[];
};

export const REQUIRED_SUBMISSION_FIELDS: Array<keyof RawProject> = [
  "project_name",
  "short_description",
  "full_description",
  "tech_stack",
  "github_repository",
  "demo_link",
  "tracks",
];

export function fieldComplete(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return false;
}

export function calcSubmissionProgress(project: RawProject): number {
  const filled = REQUIRED_SUBMISSION_FIELDS.filter((f) => fieldComplete(project[f])).length;
  return Math.round((filled / REQUIRED_SUBMISSION_FIELDS.length) * 100);
}

export type SubmissionStatus = "none" | "draft" | "complete";

export function getSubmissionStatus(
  project: RawProject | null,
): SubmissionStatus {
  if (!project) return "none";
  const progress = calcSubmissionProgress(project);
  return progress === 100 ? "complete" : "draft";
}
