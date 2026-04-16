export type Verdict = "top" | "strong" | "maybe" | "weak" | "reject";

export interface EvaluationData {
  id: string;
  formDataId: string;
  evaluatorId: string;
  evaluatorName: string;
  verdict: Verdict;
  comment: string | null;
  scoreOverall: number | null;
  scores: Record<string, number> | null;
  createdAt: string;
  stage: number;
}

export interface ProjectData {
  id: string;
  projectName: string;
  shortDescription: string;
  fullDescription: string;
  techStack: string;
  githubRepository: string;
  demoLink: string;
  demoVideoLink: string;
  tracks: string[];
  categories: string[];
  isPreexistingIdea: boolean;
  createdAt: string;
  members: ProjectMember[];
}

export interface ProjectMember {
  id: string;
  email: string;
  role: string;
  status: string;
}

export interface MemberApplication {
  email: string;
  name: string;
  role: string;
  status: string;
  data: Record<string, unknown> | null;
}

export interface SubmissionRow {
  formDataId: string;
  projectId: string;
  projectName: string;
  shortDescription: string;
  hackathonId: string;
  hackathonTitle: string;
  origin: string;
  formData: Record<string, unknown>;
  finalVerdict: Verdict | null;
  project: ProjectData | null;
  evaluations: EvaluationData[];

  // Lead applicant info (from Member → User)
  applicantName: string;
  applicantEmail: string;
  country: string;
  telegram: string | null;
  github: string | null;

  // Event-specific extracted fields
  areaOfFocus: string | null;
  stageProgress: number;
  currentStage: number;

  // Per-member applications (e.g., BuildGamesApplication data for each team member)
  memberApplications: MemberApplication[];

  // Legacy: single application data from FormData.form_data.applicant
  applicationData: Record<string, unknown> | null;
}

export type SortField =
  | "projectName"
  | "hackathon"
  | "origin"
  | "verdict"
  | "teamSize"
  | "createdAt"
  | "applicant"
  | "email"
  | "areaOfFocus"
  | "country"
  | "stageProgress";

export type SortDirection = "asc" | "desc";
