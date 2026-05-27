/**
 * Calculates submission completeness for a project saved in the database.
 * Mirrors the required-field logic in GeneralSecure.tsx / FormSchema.
 */

type RawProject = {
  id: string;
  project_name: string;
  short_description: string;
  full_description: string | null;
  tech_stack: string | null;
  github_repository: string | null;
  demo_link: string | null;
  tracks: string[];
};

const REQUIRED_FIELDS: Array<keyof RawProject> = [
  "project_name",
  "short_description",
  "full_description",
  "tech_stack",
  "github_repository",
  "demo_link",
  "tracks",
];

function fieldComplete(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return false;
}

export function calcSubmissionProgress(project: RawProject): number {
  const filled = REQUIRED_FIELDS.filter((f) => fieldComplete(project[f])).length;
  return Math.round((filled / REQUIRED_FIELDS.length) * 100);
}

export type SubmissionStatus = "none" | "draft" | "complete";

export function getSubmissionStatus(
  project: RawProject | null,
): SubmissionStatus {
  if (!project) return "none";
  const progress = calcSubmissionProgress(project);
  return progress === 100 ? "complete" : "draft";
}
