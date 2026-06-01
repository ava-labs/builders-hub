// lib/events-field-labels.ts

/** Maps a dot-notation RHF error path to a human-readable label and section. */
export const FIELD_LABELS: Record<string, { label: string; section: string }> = {
  title:                            { label: 'Event Title',            section: 'Basic Info' },
  description:                      { label: 'Description',                section: 'Basic Info' },
  location:                         { label: 'City / Location',            section: 'Basic Info' },
  tags:                             { label: 'Tags',                       section: 'Basic Info' },
  organizers:                       { label: 'Organizer Name/Organization', section: 'Participants & Prizes' },
  total_prizes:                     { label: 'Total Prizes',               section: 'Participants & Prizes' },
  participants:                     { label: 'Participants',               section: 'Participants & Prizes' },
  is_public:                        { label: 'Public Visibility',          section: 'Basic Info' },
  start_date:                       { label: 'Start Date',                 section: 'Last Details' },
  end_date:                         { label: 'End Date',                   section: 'Last Details' },
  timezone:                         { label: 'Timezone',                   section: 'Last Details' },
  custom_link:                      { label: 'Custom Link',                section: 'Last Details' },
  banner:                           { label: 'Main Banner URL',            section: 'Images & Branding' },
  small_banner:                     { label: 'Small Banner URL',           section: 'Images & Branding' },
  event:                            { label: 'Event Type',                 section: 'Basic Info' },
  new_layout:                       { label: 'New Layout',                 section: 'Basic Info' },
  google_calendar_id:               { label: 'Google Calendar ID',         section: 'Content' },
  cohosts:                          { label: 'Cohost Emails',              section: 'Cohosts' },
  'main.title':                     { label: 'Event Title',              section: 'Basic Info' },
  'main.description':               { label: 'Description',              section: 'Basic Info' },
  'main.location':                  { label: 'City / Location',          section: 'Basic Info' },
  'main.tags':                      { label: 'Tags',                     section: 'Basic Info' },
  'main.organizers':                { label: 'Organizer Name/Organization', section: 'Participants & Prizes' },
  'main.total_prizes':              { label: 'Total Prizes',             section: 'Participants & Prizes' },
  'main.participants':              { label: 'Participants',             section: 'Participants & Prizes' },
  'main.start_date':              { label: 'Start Date',               section: 'Basic Info' },
  'main.end_date':                { label: 'End Date',                 section: 'Basic Info' },
  'main.timezone':                { label: 'Timezone',                 section: 'Basic Info' },
  'main.submission_deadline':    { label: 'Submission Deadline',      section: 'Basic Info' },
  'content.join_custom_link':       { label: 'Join Custom Link',         section: 'Advanced Options' },
  'content.submission_custom_link': { label: 'Submission Custom Link',   section: 'Advanced Options' },
  'latest.submission_deadline':     { label: 'Submission Deadline',      section: 'Basic Info' },
  'latest.custom_link':             { label: 'Custom Link',              section: 'Advanced Options' },
  'latest.banner':                  { label: 'Main Banner URL',          section: 'Images & Branding' },
  'latest.small_banner':            { label: 'Small Banner URL',         section: 'Images & Branding' },
  'content.tracks_text':            { label: 'Tracks Text',              section: 'Track Text' },
  'content.address':                { label: 'Address',                  section: 'Basic Info' },
  'content.speakers_text':          { label: 'Speakers Text',            section: 'Content' },
  'content.speakers_banner':        { label: 'Speakers Banner',          section: 'Content' },
  'content.judging_guidelines':     { label: 'Judging Guidelines',       section: 'Content' },
  'content.become_sponsor_link':    { label: 'Become Sponsor Link',      section: 'Content' },
  'content.join_custom_text':       { label: 'Join Custom Text',         section: 'Content' },
  'content.language':               { label: 'Content Language',          section: 'Content' },
  'content.registration_deadline':  { label: 'Registration Deadline',   section: 'Content' },
  'content.submission_deadline':    { label: 'Submission Deadline',     section: 'Basic Info' },
  'cohostsEmails':                  { label: 'Cohost Emails',            section: 'Cohosts' },
};

/** Resolves a path that may include array indices, e.g. "content.tracks.2.name" */
export function resolveFieldLabel(path: string): { label: string; section: string } {
  const toTitleCase = (value: string): string =>
    value
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());

  // Direct match
  if (FIELD_LABELS[path]) return FIELD_LABELS[path];

  // Array item: content.tracks.2.name → "Track #3 – Name"
  const trackMatch = path.match(/^content\.tracks\.(\d+)\.(.+)$/);
  if (trackMatch) {
    const idx = parseInt(trackMatch[1], 10);
    const field = toTitleCase(trackMatch[2]);
    return { label: `Track #${idx + 1} - ${field}`, section: 'Content (Tracks)' };
  }

  const scheduleMatch = path.match(/^content\.schedule\.(\d+)\.(.+)$/);
  if (scheduleMatch) {
    const idx = parseInt(scheduleMatch[1], 10);
    const field = toTitleCase(scheduleMatch[2]);
    return { label: `Schedule #${idx + 1} - ${field}`, section: 'Content (Schedule)' };
  }

  const scheduleItemMatch = path.match(/^content\.schedule\.(\d+)$/);
  if (scheduleItemMatch) {
    const idx = parseInt(scheduleItemMatch[1], 10);
    return { label: `Schedule #${idx + 1}`, section: 'Content (Schedule)' };
  }

  const speakerMatch = path.match(/^content\.speakers\.(\d+)\.(.+)$/);
  if (speakerMatch) {
    const idx = parseInt(speakerMatch[1], 10);
    const field = toTitleCase(speakerMatch[2]);
    return { label: `Speaker #${idx + 1} - ${field}`, section: 'Content (Speakers)' };
  }

  const resourceMatch = path.match(/^content\.resources\.(\d+)\.(.+)$/);
  if (resourceMatch) {
    const idx = parseInt(resourceMatch[1], 10);
    const field = toTitleCase(resourceMatch[2]);
    return { label: `Resource #${idx + 1} - ${field}`, section: 'Content (Resources)' };
  }

  const partnerMatch = path.match(/^content\.partners\.(\d+)\.(.+)$/);
  if (partnerMatch) {
    const idx = parseInt(partnerMatch[1], 10);
    const field = toTitleCase(partnerMatch[2]);
    return { label: `Partner #${idx + 1} - ${field}`, section: 'Content (Partners)' };
  }

  const cohostMatch = path.match(/^cohosts\.(\d+)$/);
  if (cohostMatch) {
    const idx = parseInt(cohostMatch[1], 10);
    return { label: `Cohost Email #${idx + 1}`, section: 'Cohosts' };
  }

  // Stage submit form chips: content.stages.N.submitForm.fields.M.chips.K
  const stageSubmitChipMatch = path.match(/^content\.stages\.(\d+)\.submitForm\.fields\.(\d+)\.chips\.(\d+)$/);
  if (stageSubmitChipMatch) {
    const stageIdx = parseInt(stageSubmitChipMatch[1], 10);
    const fieldIdx = parseInt(stageSubmitChipMatch[2], 10);
    const chipIdx = parseInt(stageSubmitChipMatch[3], 10);
    return { label: `Stage #${stageIdx + 1} - Field #${fieldIdx + 1} - Chip #${chipIdx + 1}`, section: 'Stages' };
  }

  // Stage submit form field: content.stages.N.submitForm.fields.M.FIELD
  const stageSubmitFieldMatch = path.match(/^content\.stages\.(\d+)\.submitForm\.fields\.(\d+)\.(.+)$/);
  if (stageSubmitFieldMatch) {
    const stageIdx = parseInt(stageSubmitFieldMatch[1], 10);
    const fieldIdx = parseInt(stageSubmitFieldMatch[2], 10);
    const fieldName = stageSubmitFieldMatch[3];
    const submitFieldLabels: Record<string, string> = {
      label: 'Label', placeholder: 'Placeholder', description: 'Description',
      required: 'Required', maxCharacters: 'Max Characters', chips: 'Chips',
      id: 'ID', type: 'Type',
    };
    const humanField = submitFieldLabels[fieldName] ?? toTitleCase(fieldName);
    return { label: `Stage #${stageIdx + 1} - Field #${fieldIdx + 1} - ${humanField}`, section: 'Stages' };
  }

  // Stage submit form root: content.stages.N.submitForm.fields (array-level error)
  const stageSubmitFormMatch = path.match(/^content\.stages\.(\d+)\.submitForm\.fields$/);
  if (stageSubmitFormMatch) {
    const stageIdx = parseInt(stageSubmitFormMatch[1], 10);
    return { label: `Stage #${stageIdx + 1} – Submit Form Fields`, section: 'Stages' };
  }

  // Generic stage field: content.stages.N.FIELD
  const stageMatch = path.match(/^content\.stages\.(\d+)\.(.+)$/);
  if (stageMatch) {
    const idx = parseInt(stageMatch[1], 10);
    const stageFieldLabels: Record<string, string> = {
      label: 'Label', date: 'Date', deadline: 'Deadline',
    };
    const field = stageFieldLabels[stageMatch[2]] ?? toTitleCase(stageMatch[2]);
    return { label: `Stage #${idx + 1} - ${field}`, section: 'Stages' };
  }

  const tagMatch = path.match(/^main\.tags\.(\d+)$/);
  if (tagMatch) {
    const idx = parseInt(tagMatch[1], 10);
    return { label: `Tag #${idx + 1}`, section: 'Basic Info' };
  }

  const flatTagMatch = path.match(/^tags\.(\d+)$/);
  if (flatTagMatch) {
    const idx = parseInt(flatTagMatch[1], 10);
    return { label: `Tag #${idx + 1}`, section: 'Basic Info' };
  }

  // Fallback: format the raw path
  return { label: path.replace(/\./g, ' › ').replace(/_/g, ' '), section: 'Form' };
}