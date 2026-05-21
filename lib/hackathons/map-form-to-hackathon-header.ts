import type {
  HackathonHeader,
  HackathonStatus,
  Partner,
  ScheduleActivity,
  Speaker,
  Track,
} from '@/types/hackathons';
import type {
  IDataContent,
  IDataLatest,
  IDataMain,
  IPartner,
  IResource,
  ISchedule,
  ISpeaker,
  ITrack,
} from '@/app/events/edit/initials';

function computeStatus(startIso: string, endIso: string): HackathonStatus {
  if (!startIso?.trim() || !endIso?.trim()) return 'UPCOMING';
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'UPCOMING';
  const now = Date.now();
  if (start.getTime() <= now && end.getTime() >= now) return 'ONGOING';
  if (start.getTime() > now) return 'UPCOMING';
  return 'ENDED';
}

function parseContentDate(s: string | null | undefined): Date {
  if (!s || !String(s).trim()) return new Date(NaN);
  const d = new Date(s);
  return d;
}

function mapSchedule(items: ISchedule[]): ScheduleActivity[] {
  const filtered = items.filter((s) => s.date?.trim() || s.name?.trim());
  return filtered.map((s) => ({
    stage: '',
    date: s.date || '',
    duration: Number(s.duration) || 0,
    name: s.name || '',
    description: s.description || '',
    host_name: '',
    host_media: '',
    host_icon: '',
    location: s.location || '',
    category: s.category || '',
    url: s.url ?? '',
    video_call_url: s.url ?? undefined,
  }));
}

function mapTracks(items: ITrack[]): Track[] {
  const filtered = items.filter((t) => t.name?.trim() || t.short_description?.trim());
  return filtered.map((t) => ({
    name: t.name,
    short_description: t.short_description,
    icon: t.icon || t.logo || '',
    logo: t.logo || t.icon || '',
    description: t.description,
    total_reward: 0,
    partner: t.partner,
    resources: [],
  }));
}

function mapSpeakers(items: ISpeaker[]): Speaker[] {
  const filtered = items.filter((s) => s.name?.trim());
  return filtered.map((s) => ({
    name: s.name,
    picture: s.picture,
    category: s.category,
    icon: '',
  }));
}

function mapResources(items: IResource[]) {
  return items
    .filter((r) => r.title?.trim() || r.link?.trim())
    .map((r) => ({
      title: r.title,
      description: r.description,
      icon: r.icon,
      link: r.link,
    }));
}

function mapPartners(items: IPartner[]): Partner[] {
  return items
    .filter((p) => p.name?.trim())
    .map((p) => ({
      name: p.name,
      logo: p.logo || '',
      about: '',
      links: [],
    }));
}

export function mapFormToHackathonHeader(params: {
  main: IDataMain;
  content: IDataContent;
  latest: IDataLatest;
  id?: string;
}): HackathonHeader {
  const { main, content, latest, id } = params;

  const start_date = latest.start_date || '';
  const end_date = latest.end_date || '';

  return {
    id: id || 'preview',
    title: main.title,
    description: main.description,
    start_date,
    end_date,
    location: main.location,
    total_prizes: main.total_prizes ?? 0,
    participants: main.participants ?? 0,
    tags: (main.tags || []).filter((t) => Boolean(t && String(t).trim())),
    organizers: main.organizers ?? '',
    cohosts: [],
    status: computeStatus(start_date, end_date),
    small_banner: latest.small_banner ?? '',
    banner: latest.banner ?? '',
    icon: latest.icon ?? '',
    timezone: latest.timezone?.trim() ? latest.timezone : 'UTC',
    content: {
      language: content.language,
      join_custom_link: content.join_custom_link ?? '',
      join_custom_text: content.join_custom_text ?? '',
      submission_custom_link: content.submission_custom_link ?? '',
      schedule: mapSchedule(content.schedule || []),
      registration_deadline: parseContentDate(content.registration_deadline),
      address: content.address ?? '',
      partners: mapPartners(content.partners || []),
      tracks_text: content.tracks_text ?? '',
      tracks: mapTracks(content.tracks || []),
      speakers: mapSpeakers(content.speakers || []),
      become_sponsor_link: content.become_sponsor_link ?? '',
      submission_deadline: parseContentDate(content.submission_deadline),
      mentors_judges_img_url: '',
      judging_guidelines: content.judging_guidelines ?? '',
      speakers_banner: content.speakers_banner ?? '',
      speakers_text: content.speakers_text ?? '',
      resources: mapResources(content.resources || []),
      stages: content.stages ?? [],
    },
    top_most: latest.top_most ?? false,
    custom_link: latest.custom_link ?? undefined,
    created_by: '',
    is_public: main.is_public ?? true,
    event: latest.event,
    new_layout: latest.new_layout,
    google_calendar_id: latest.google_calendar_id,
  };
}
