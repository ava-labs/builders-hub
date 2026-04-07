export type HackathonStatus = "ENDED" | "ONGOING" | "UPCOMING"
export type HackathonHeader = {
  id: string
  title: string
  description: string
  start_date: string
  end_date: string
  location: string
  total_prizes: number
  participants: number
  tags: string[]
  organizers: string 
  cohosts: string[]
  status: HackathonStatus
  small_banner: string
  banner: string
  icon: string
  timezone: string
  content: Hackathon
  top_most: boolean
  custom_link: string | undefined
  created_by: string
  created_by_name?: string
  updated_by?: string
  updated_by_name?: string
  is_public: boolean
  event?: string
  /** When true, use modern event layout; when false, use legacy layout. Null/undefined falls back to event type. */
  new_layout?: boolean | null
  /** Google Calendar ID for schedule integration - if set, uses Google Calendar API instead of DB */
  google_calendar_id?: string | null
}

export type HackathonsFilters = {
  location?: string
  status?: HackathonStatus | null
  page?: number
  recordsByPage?: number
}

export type Hackathon = {
  /** Content language for event-specific UI strings. Defaults to 'en' when missing. */
  language?: "en" | "es"
  join_custom_link: string
  join_custom_text: string
  submission_custom_link: string
  schedule: ScheduleActivity[]
  registration_deadline: Date
  address: string
  partners: Partner[]
  tracks_text: string
  tracks: Track[]
  speakers: Speaker[]
  become_sponsor_link: string
  submission_deadline: Date
  mentors_judges_img_url: string
  judging_guidelines: string
  speakers_banner: string
  speakers_text: string
  resources: Resource[]
}

export type ScheduleActivity = {
  stage: string
  date: string
  duration: number //Duration in minutes
  name: string
  description: string
  host_name: string
  host_media: string
  host_icon: string
  location: string
  category: string
  url: string
  /** Video call URL (Google Meet, Zoom, etc.) - separate from physical location */
  video_call_url?: string
}

export type Track = {
  name: string
  short_description: string
  icon: string
  logo: string
  description: string //Markdown
  total_reward: number
  partner?: string
  resources: Resource[]
}



export type Resource = {
  title: string
  description: string
  icon: string
  link: string
}


export type Partner = {
  name: string
  about: string
  links: Resource[]
  logo: string
}

export type Speaker = {
  name: string
  picture: string
  icon: string
  category: string
}


