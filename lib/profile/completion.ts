export type CompletionStepKey =
  | "name"
  | "bio"
  | "country"
  | "roles"
  | "github"
  | "x"
  | "telegram"
  | "linkedin"
  | "wallet"
  | "skills"
  | "hackathon"
  | "project"
  | "console";

export interface CompletionInput {
  fullName?: string | null;
  bio?: string | null;
  country?: string | null;
  roles?: ReadonlyArray<string> | null;
  github?: string | null;
  xAccount?: string | null;
  telegram?: string | null;
  linkedin?: string | null;
  wallets?: ReadonlyArray<unknown> | null;
  skills?: ReadonlyArray<unknown> | null;
  hasHackathonParticipation?: boolean;
  hasProject?: boolean;
  hasUsedConsole?: boolean;
}

export interface CompletionStep {
  key: CompletionStepKey;
  label: string;
  description: string;
  test: (p: CompletionInput) => boolean;
}

const has = (s: unknown): s is string =>
  typeof s === "string" && s.trim().length > 0;

export const COMPLETION_STEPS: ReadonlyArray<CompletionStep> = [
  {
    key: "name",
    label: "Add your full name",
    description: "Required for grant verification",
    test: (p) => has(p.fullName),
  },
  {
    key: "bio",
    label: "Write a short bio",
    description: "20+ character intro",
    test: (p) => (p.bio ?? "").trim().length >= 20,
  },
  {
    key: "country",
    label: "Set your country",
    description: "Helps match local programs",
    test: (p) => has(p.country),
  },
  {
    key: "roles",
    label: "Pick your roles",
    description: "At least one role",
    test: (p) => Array.isArray(p.roles) && p.roles.length > 0,
  },
  {
    key: "github",
    label: "Connect GitHub",
    description: "Verify on-chain commits",
    test: (p) => has(p.github),
  },
  {
    key: "x",
    label: "Connect X",
    description: "Link your X profile",
    test: (p) => has(p.xAccount),
  },
  {
    key: "telegram",
    label: "Connect Telegram",
    description: "Reach you for grant follow-ups",
    test: (p) => has(p.telegram),
  },
  {
    key: "linkedin",
    label: "Connect LinkedIn",
    description: "Showcase your background",
    test: (p) => has(p.linkedin),
  },
  {
    key: "wallet",
    label: "Connect EVM wallet",
    description: "Required for rewards",
    test: (p) => Array.isArray(p.wallets) && p.wallets.length > 0,
  },
  {
    key: "skills",
    label: "Add 3+ skills",
    description: "Improves matching",
    test: (p) => Array.isArray(p.skills) && p.skills.length >= 3,
  },
  {
    key: "hackathon",
    label: "Participate in a hackathon",
    description: "Join an Avalanche event",
    test: (p) => p.hasHackathonParticipation === true,
  },
  {
    key: "project",
    label: "Create a project",
    description: "Submit one to the showcase",
    test: (p) => p.hasProject === true,
  },
  {
    key: "console",
    label: "Use the console",
    description: "Try a Builder Hub tool",
    test: (p) => p.hasUsedConsole === true,
  },
];

export interface CompletionResult {
  pct: number;
  completed: number;
  total: number;
  next: CompletionStep | null;
  status: Record<CompletionStepKey, boolean>;
}

export function computeCompletion(input: CompletionInput): CompletionResult {
  const status = {} as Record<CompletionStepKey, boolean>;
  let completed = 0;
  for (const step of COMPLETION_STEPS) {
    const ok = step.test(input);
    status[step.key] = ok;
    if (ok) completed += 1;
  }
  const total = COMPLETION_STEPS.length;
  const next = COMPLETION_STEPS.find((s) => !status[s.key]) ?? null;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { pct, completed, total, next, status };
}
