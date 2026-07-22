import posthog from "posthog-js";

// Semantic homepage events, on top of PostHog's autocapture. Autocapture
// gives raw element clicks; these give queryable funnel steps with a
// stable home_* schema:
//   home_section_viewed  { section }
//   home_cta_clicked     { section, label, href }
//   home_pillar_selected { pillar }
//   home_playbook_selected { playbook }
//   home_chain_clicked   { chain }
export function track(event: string, props?: Record<string, unknown>): void {
  try {
    posthog.capture(event, props);
  } catch {
    // analytics must never break the page
  }
}
