import type { Hackathon } from "@/types/hackathons";

/**
 * Default tech-stack taxonomy from the SPEEDRUN spec. Used when a hackathon
 * doesn't override `content.tech_stack_options`. Mirrors the tracks pattern:
 * the option list lives on the hackathon, defaults are codified, and
 * submissions store `String[]` of selected names.
 */
export const DEFAULT_TECH_STACK_OPTIONS: { name: string }[] = [
  { name: "Frontend" },
  { name: "Backend" },
  { name: "Smart Contract" },
  { name: "AI/ML" },
  { name: "Mobile" },
  { name: "Infra" },
  { name: "Other" },
];

export interface TechStackOption {
  name: string;
}

/**
 * Returns the tech-stack options to render in the submission form for this
 * hackathon. Falls back to the SPEEDRUN defaults when the admin hasn't
 * customized the list.
 */
export function getTechStackOptions(
  hackathon: Pick<Hackathon, "tech_stack_options"> | null | undefined,
): TechStackOption[] {
  const customized = hackathon?.tech_stack_options;
  if (Array.isArray(customized) && customized.length > 0) {
    return customized.filter((opt) => opt?.name?.trim()).map((opt) => ({ name: opt.name.trim() }));
  }
  return DEFAULT_TECH_STACK_OPTIONS;
}
