// lib/events-field-labels.ts

/** Maps a dot-notation RHF error path to a human-readable label and section. */
export const FIELD_LABELS: Record<string, { label: string; section: string }> = {
  'main.title':                     { label: 'Hackathon Title',          section: 'Basic Info' },
  'main.description':               { label: 'Description',              section: 'Basic Info' },
  'main.location':                  { label: 'City / Location',          section: 'Basic Info' },
  'main.tags':                      { label: 'Tags',                     section: 'Basic Info' },
  'main.organizers':                { label: 'Organizer Name/Organization', section: 'Participants & Prizes' },
  'main.total_prizes':              { label: 'Total Prizes',             section: 'Participants & Prizes' },
  'main.participants':              { label: 'Participants',             section: 'Participants & Prizes' },
  'latest.start_date':              { label: 'Start Date',               section: 'Last Details' },
  'latest.end_date':                { label: 'End Date',                 section: 'Last Details' },
  'latest.timezone':                { label: 'Timezone',                 section: 'Last Details' },
  'content.join_custom_link':       { label: 'Join Custom Link',         section: 'Last Details' },
  'content.submission_custom_link': { label: 'Submission Custom Link',   section: 'Last Details' },
  'latest.custom_link':             { label: 'Custom Link',              section: 'Last Details' },
  'latest.banner':                  { label: 'Main Banner URL',          section: 'Images & Branding' },
  'latest.small_banner':            { label: 'Small Banner URL',         section: 'Images & Branding' },
  'content.tracks_text':            { label: 'Tracks Text',              section: 'Track Text' },
  'content.address':                { label: 'Address',                  section: 'Content' },
  'content.speakers_text':          { label: 'Speakers Text',            section: 'Content' },
  'content.judging_guidelines':     { label: 'Judging Guidelines',       section: 'Content' },
  'content.submission_deadline':    { label: 'Submission Deadline',      section: 'Content' },
  'content.registration_deadline':  { label: 'Registration Deadline',   section: 'Content' },
  'cohostsEmails':                  { label: 'Cohost Emails',            section: 'Cohosts' },
};

/** Resolves a path that may include array indices, e.g. "content.tracks.2.name" */
export function resolveFieldLabel(path: string): { label: string; section: string } {
  // Direct match
  if (FIELD_LABELS[path]) return FIELD_LABELS[path];

  // Array item: content.tracks.2.name → "Track #3 – Name"
  const trackMatch = path.match(/^content\.tracks\.(\d+)\.(.+)$/);
  if (trackMatch) {
    const idx = parseInt(trackMatch[1], 10);
    const field = trackMatch[2].replace(/_/g, ' ');
    return { label: `Track #${idx + 1} – ${field}`, section: 'Content (Tracks)' };
  }

  const scheduleMatch = path.match(/^content\.schedule\.(\d+)\.(.+)$/);
  if (scheduleMatch) {
    const idx = parseInt(scheduleMatch[1], 10);
    const field = scheduleMatch[2].replace(/_/g, ' ');
    return { label: `Schedule #${idx + 1} – ${field}`, section: 'Content (Schedule)' };
  }

  const speakerMatch = path.match(/^content\.speakers\.(\d+)\.(.+)$/);
  if (speakerMatch) {
    const idx = parseInt(speakerMatch[1], 10);
    const field = speakerMatch[2].replace(/_/g, ' ');
    return { label: `Speaker #${idx + 1} – ${field}`, section: 'Content (Speakers)' };
  }

  const resourceMatch = path.match(/^content\.resources\.(\d+)\.(.+)$/);
  if (resourceMatch) {
    const idx = parseInt(resourceMatch[1], 10);
    const field = resourceMatch[2].replace(/_/g, ' ');
    return { label: `Resource #${idx + 1} – ${field}`, section: 'Content (Resources)' };
  }

  const stageMatch = path.match(/^content\.stages\.(\d+)\.(.+)$/);
  if (stageMatch) {
    const idx = parseInt(stageMatch[1], 10);
    const field = stageMatch[2].replace(/_/g, ' ');
    return { label: `Stage #${idx + 1} – ${field}`, section: 'Stages' };
  }

  const tagMatch = path.match(/^main\.tags\.(\d+)$/);
  if (tagMatch) {
    const idx = parseInt(tagMatch[1], 10);
    return { label: `Tag #${idx + 1}`, section: 'Basic Info' };
  }

  // Fallback: format the raw path
  return { label: path.replace(/\./g, ' › ').replace(/_/g, ' '), section: 'Form' };
}