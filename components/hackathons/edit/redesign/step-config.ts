import type { HackathonEditFormValues } from '@/lib/hackathons/hackathon-edit.schema';

/**
 * Step taxonomy for the redesigned event editor.
 *
 * These map 1:1 onto the editor's existing content sections (so navigation and
 * field ownership stay aligned with the current `react-hook-form` shape —
 * `main`, `content`, `latest`, `cohostsEmails` — without re-plumbing data):
 *
 *   overview → "Main Topics"  (basics + dates + timezone)
 *   branding → "Images & Branding"
 *   details  → "Participants & Prizes" (organizer, prizes, team size, scope)
 *   about    → "About" (long-form description)
 *   content  → "Content" (tracks, tech stack, schedule, speakers, partners, resources)
 *   stages   → "Stages" (submission stages + forms)
 */
export type StepId = 'overview' | 'branding' | 'details' | 'about' | 'content' | 'stages';

export type StepIcon = 'compass' | 'sparkles' | 'users' | 'library' | 'layout' | 'layers';

export type StepDef = {
  id: StepId;
  label: string;
  hint: string;
  icon: StepIcon;
};

export const STEPS: StepDef[] = [
  { id: 'overview', label: 'Overview', hint: 'Type · basics · dates', icon: 'compass' },
  { id: 'branding', label: 'Branding', hint: 'Banner · social', icon: 'sparkles' },
  { id: 'details', label: 'Participants', hint: 'Organizer · prizes · team', icon: 'users' },
  { id: 'about', label: 'About', hint: 'Long-form description', icon: 'library' },
  { id: 'content', label: 'Content', hint: 'Tracks · schedule · people', icon: 'layout' },
  { id: 'stages', label: 'Stages', hint: 'Submission flow', icon: 'layers' },
];

type Values = HackathonEditFormValues;

function hasText(v: unknown): boolean {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * Per-step completeness for the sidebar readiness dots and the publish gate.
 * Reads current form values so it stays in sync with what the user typed.
 * Optional sections (about, stages) report ready so they never block publish.
 */
export function isStepReady(id: StepId, values: Values): boolean {
  const main = values.main ?? ({} as Values['main']);
  const content = values.content ?? ({} as Values['content']);
  const latest = values.latest ?? ({} as Values['latest']);
  const isHackathon = (latest.event ?? 'hackathon') === 'hackathon';

  switch (id) {
    case 'overview':
      return (
        hasText(main.title) &&
        hasText(main.description) &&
        hasText(main.location) &&
        hasText(latest.start_date) &&
        hasText(latest.end_date) &&
        hasText(latest.timezone)
      );
    case 'branding':
      return hasText(latest.banner) || hasText(latest.small_banner) || hasText(latest.icon);
    case 'details':
      return hasText(main.organizers);
    case 'about':
      return true;
    case 'content':
      if (!isHackathon) return true;
      return Array.isArray(content.tracks) && content.tracks.some((t) => hasText(t?.name));
    case 'stages':
      return true;
    default:
      return false;
  }
}

/** Readiness summary across all steps. */
export function computeReadiness(values: Values): {
  ready: Record<StepId, boolean>;
  readyCount: number;
  total: number;
  pct: number;
  allReady: boolean;
} {
  const ready = {} as Record<StepId, boolean>;
  let readyCount = 0;
  for (const s of STEPS) {
    const ok = isStepReady(s.id, values);
    ready[s.id] = ok;
    if (ok) readyCount += 1;
  }
  const total = STEPS.length;
  const pct = total > 0 ? Math.round((readyCount / total) * 100) : 0;
  return { ready, readyCount, total, pct, allReady: readyCount === total };
}
