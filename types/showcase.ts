import { User } from "@prisma/client";
import { HackathonHeader } from "./hackathons";
import { ProjectBadge } from "./badge";

export const PROJECT_VISIBILITY = {
  PRIVATE: "private",
  SEMI_PUBLIC: "semi-public",
  PUBLIC: "public",
} as const;

export type ProjectVisibility =
  (typeof PROJECT_VISIBILITY)[keyof typeof PROJECT_VISIBILITY];

export const PROJECT_VISIBILITY_VALUES: ProjectVisibility[] = [
  PROJECT_VISIBILITY.PRIVATE,
  PROJECT_VISIBILITY.SEMI_PUBLIC,
  PROJECT_VISIBILITY.PUBLIC,
];

export function isProjectVisibility(value: unknown): value is ProjectVisibility {
  return (
    typeof value === "string" &&
    (PROJECT_VISIBILITY_VALUES as string[]).includes(value)
  );
}

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
  badges?: ProjectBadge[];
  hackathon: ProjectHackathonInfo | null;
  origin: string;
  visibility?: ProjectVisibility;
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

export type ProjectResource = {
  icon: string
  title: string
  link: string
}