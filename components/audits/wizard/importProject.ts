import type { AuditWizardValues } from "@/components/audits/wizard/types";

// Minimal slice of the Project rows GET /api/projects/member returns (a bare
// array). website/socials are untyped Json in two historical shapes; the
// readProjectUrl normalizer is lifted from the mini-grants apply page.
export interface ImportableProject {
  id: string;
  project_name: string;
  short_description?: string | null;
  full_description?: string | null;
  website?: unknown;
  demo_link?: string | null;
  github_repository?: string | null;
}

export async function fetchMyProjects(): Promise<ImportableProject[]> {
  const res = await fetch("/api/projects/member");
  if (!res.ok) throw new Error("Could not load your projects.");
  const data = await res.json();
  return Array.isArray(data) ? (data as ImportableProject[]) : [];
}

// Best-effort read of a project's URL: stored as website { url } by the
// standalone wizard, falling back to demo_link for projects created elsewhere.
function readProjectUrl(row: { website?: unknown; demo_link?: string | null }): string {
  const site = row.website as { url?: string } | null | undefined;
  return (site?.url || row.demo_link || "").trim();
}

/**
 * Import pre-fill (design step 1): name, description, website and repos come
 * from the project record; everything stays editable and the request keeps
 * its own snapshot.
 */
export function projectToWizardPatch(project: ImportableProject): Partial<AuditWizardValues> {
  const github = (project.github_repository ?? "").trim();
  return {
    source_project_id: project.id,
    project_name: project.project_name ?? "",
    description: (project.full_description || project.short_description || "").trim(),
    website: readProjectUrl(project),
    repos: /^https?:\/\//i.test(github) ? [{ url: github, ref: "" }] : [],
  };
}
