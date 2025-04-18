import { User } from "@prisma/client";
import { HackathonHeader } from "./hackathons";

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
  tags: string[];
  created_at: string;
  updated_at: string;
  members: Member[];
  prizes: ProjectPrize[];
  hackathon: HackathonHeader;
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
  price: number
  track: string
}

export type ProjectResource = {
  icon: string
  title: string
  link: string
}
