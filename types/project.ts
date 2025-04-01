import { User } from "@prisma/client";

export interface Project {
  id: string;
  hackaton_id: string,
  project_name: string;
  short_description: string;
  full_description?: string;
  tech_stack?: string,
  github_repository?: string,
  demo_link?: string,
  open_source: boolean;
  logo_url?: string;
  cover_url?: string;
  demo_video_link?: string;
  screenshots?: string[];
  tracks: string[];
  members?: Member[]
}

export type ProjectFilters = {
  event?: string
  track?: string
  page?: number
  recordsByPage?: number
}
        
export interface Member extends User {
  role: string;
  status: string
}
