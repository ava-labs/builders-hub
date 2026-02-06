import { User } from "@prisma/client";
import { HackathonHeader } from "./hackathons";
import { ProjectBadge } from "./badge";

export type Project = {
  id: string;
  hackaton_id: string;
  project_name: string;
  short_description: string;
  full_description?: string;
  tech_stack?: string;
  github_repository?: string;
  demo_link?: string;
  open_source: boolean;
  logo_url?: string;
  cover_url?: string;
  demo_video_link?: string;
  screenshots: string[];
  tracks: string[];
  categories?: string[];
  other_category?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  is_winner?: boolean;
  members: Member[];
  prizes: ProjectPrize[];
  badges?: ProjectBadge[];
  hackathon: HackathonHeader;
  origin: string;
};

export type Member = {
  id: string;
  user_id: string;
  project_id: string;
  role: string;
  status: string;
  project: Project;
  user: User;
};

export type ProjectPrize = {
  icon: string
  prize: number
  track: string
}

export type ProjectResource = {
  icon: string
  title: string
  link: string
}