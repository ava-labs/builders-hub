import { User } from "@prisma/client";

export enum MemberStatus {
  PENDING = "Pending confirmation",
  CONFIRMED = "Confirmed",
  REJECTED = "Rejected",
  REMOVED = "Removed",
}

export interface Project {
  id: string;
  hackaton_id: string,
  project_name: string;
  short_description: string;
  full_description?: string;
  tech_stack?: string,
  github_repository?: string,
  explanation?: string,
  demo_link?: string,
  is_preexisting_idea:boolean;
  is_winner:boolean;
  logo_url?: string;
  cover_url?: string;
  tags?: string[];
  small_cover_url?: string;
  demo_video_link?: string;
  screenshots?: string[];
  tracks: string[];
  members?:Member[]
  user_id?:string
  isDraft?:boolean
}

export type ProjectFilters = {
  event?: string
  track?: string
  page?: number
  recordsByPage?: number
  search?: string
  winningProjecs?: boolean
}
        
export interface Member extends User {
  role: string;
  status: string
}
