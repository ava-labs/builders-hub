import { HackathonStage } from "./hackathon-stage"

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
  new_layout?: boolean | null
  google_calendar_id?: string | null
}

export type HackathonsFilters = {
  location?: string
  status?: HackathonStatus | null
  page?: number
  recordsByPage?: number
}

export type Hackathon = {
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
  submission_open?: string | Date
  mentors_judges_img_url: string
  judging_guidelines: string
  speakers_banner: string
  speakers_text: string
  resources: Resource[]
  team_size_min?: number
  team_size_max?: number
  registration_mode?: "full" | "simple"
  country?: string
  is_remote?: boolean
  target_countries?: string[]
  tech_stack_options?: { name: string }[]
  stages: HackathonStage[]
}

export type ScheduleActivity = {
  stage: string
  date: string
  duration: number
  name: string
  description: string
  host_name: string
  host_media: string
  host_icon: string
  location: string
  category: string
  url: string
  isVirtual: boolean
  infoUrl?: string
  video_call_url?: string
}

export type Track = {
  name: string
  short_description: string
  icon: string
  logo: string
  description: string
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
