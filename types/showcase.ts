import { User } from "@prisma/client";
import { HackathonHeader } from "./hackathons";
import { ProjectBadge } from "./badge";

/** Subset of hackathon used when loading a single project (e.g. getProject). */
export type ProjectHackathonInfo = Pick<
  HackathonHeader,
  "title" | "location" | "start_date"
>;

export type Project = {
  id: string;
  hackaton_id: string;
  project_name: string;
  short_description: string;
  full_description?: string;
  tech_stack?: string;
  github_repository?: string;
  demo_link?: string;
  open_source?: boolean;
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
  hackathon: ProjectHackathonInfo | null;
  origin: string;
};

/** User shape returned in project members (e.g. getProject), not full Prisma User. */
export type ProjectMemberUser = {
  user_name: string;
  image: string | null;
};

export type Member = {
  id: string;
  user_id: string;
  project_id: string;
  role: string;
  status: string;
  project?: Project;
  user: User | ProjectMemberUser;
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