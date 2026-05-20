import {
  Project,
  ProjectHackathonInfo,
  ProjectMemberUser,
  PROJECT_VISIBILITY,
  isProjectVisibility,
  type ProjectVisibility,
} from "@/types/showcase";
import { PrismaClient } from "@prisma/client";
import { validateEntity, Validation } from "./base";
import { revalidatePath } from "next/cache";

function resolveVisibility(value: unknown): ProjectVisibility {
  return isProjectVisibility(value) ? value : PROJECT_VISIBILITY.SEMI_PUBLIC;
}

const prisma = new PrismaClient();

export const projectValidations: Validation[] = [
  // { field: "project_name", message: "Please provide a name for the project.", validation: (project: Project) => requiredField(project, "title") },
];

export const validateProject = (project: Partial<Project>): Validation[] =>
  validateEntity(projectValidations, project);

export class ValidationError extends Error {
  public details: Validation[];
  public cause: string;

  constructor(message: string, details: Validation[]) {
    super(message);
    this.cause = "ValidationError";
    this.details = details;
  }
}

export const getFilteredProjects = async (options: GetProjectOptions) => {
  if (
    (options.page && options.page < 1) ||
    (options.pageSize && options.pageSize < 1)
  )
    throw new Error("Pagination params invalid", { cause: "BadRequest" });

  console.log("GET projects with options:", options);
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 12;
  const offset = (page - 1) * pageSize;

  // Showcase only surfaces semi-public and public projects.
  // Private projects are visible only to their owners and to evaluators.
  let filters: any = {
    visibility: {
      in: [PROJECT_VISIBILITY.SEMI_PUBLIC, PROJECT_VISIBILITY.PUBLIC],
    },
  };

  if (options.event) {
    filters.hackaton_id = options.event;
  }
  if (options.track) {
    filters.tracks = {
      has: options.track,
    };
  }
  if (options.winningProjects) {
    filters.is_winner = true
  }
  if (options.search) {
    const searchWords = options.search.split(/\s+/);
    let searchFilters: any[] = [];
    searchWords.forEach((word) => {
      searchFilters = [
        ...searchFilters,
        {
          project_name: {
            contains: word,
            mode: "insensitive",
          },
        },
        {
          full_description: {
            contains: word,
            mode: "insensitive",
          },
        },
      ];
    });
    searchFilters = [
      ...searchFilters,
      {
        tracks: {
          has: options.search,
        },
      },
    ];

    filters = {
      ...filters,
      OR: searchFilters,
    };
  }
  console.log("Filters: ", filters);

  const projects = await prisma.project.findMany({
    include: {
      members: true,
      hackathon: true,
      badges: {
        where: {
          status: 1, // BadgeAwardStatus.approved
        },
        include: {
          badge: true,
        },
      },
    },
    where: filters,
    skip: offset,
    take: pageSize,
  });

  const totalProjects = await prisma.project.count({
    where: filters,
  });

  return {
    projects: projects.map((project) => {
      const isSemiPublic = project.visibility === PROJECT_VISIBILITY.SEMI_PUBLIC;
      return {
        ...project,
        members: [],
        hackathon: project.hackathon ? {
          ...project.hackathon,
          content: project.hackathon.content as any,
        } : null,
        badges: project.badges?.map((projectBadge: any) => ({
          ...projectBadge,
          name: projectBadge.badge.name,
          image_path: projectBadge.badge.image_path,
        })),
        // Semi-public projects expose only name / short_description / members.
        // Strip the rest so the public showcase respects user consent.
        ...(isSemiPublic && {
          full_description: "",
          tech_stack: "",
          github_repository: "",
          demo_link: "",
          demo_video_link: "",
          screenshots: [],
          deployed_addresses: [],
          website: null,
          socials: null,
        }),
      };
    }),
    total: totalProjects,
    page,
    pageSize,
  };
};

export async function getProject(id: string): Promise<Project> {
  const row = await prisma.project.findUnique({
    include: {
      members: {
        include: {
          user: true,
        },
      },
      hackathon: true,
    },
    where: { id },
  });
  if (!row) throw new Error("Project not found", { cause: "BadRequest" });

  const hackathon: ProjectHackathonInfo | null = row.hackathon
    ? {
        title: row.hackathon.title,
        location: row.hackathon.location,
        start_date: row.hackathon.start_date.toISOString(),
      }
    : null;

  const members = row.members.map((member) => ({
    id: member.id,
    user_id: member.user_id ?? "",
    project_id: member.project_id,
    role: member.role,
    status: member.status,
    user: {
      user_name: member.user?.name ?? "",
      image: member.user?.image ?? null,
    } satisfies ProjectMemberUser,
  }));

  const project: Project = {
    id: row.id,
    hackaton_id: row.hackaton_id ?? "",
    project_name: row.project_name,
    short_description: row.short_description,
    full_description: row.full_description ?? undefined,
    tech_stack: row.tech_stack ?? undefined,
    github_repository: row.github_repository ?? undefined,
    demo_link: row.demo_link ?? undefined,
    // open_source no existe en Prisma schema, omitido (es opcional en Project)
    logo_url: row.logo_url ?? undefined,
    cover_url: row.cover_url ?? undefined,
    demo_video_link: row.demo_video_link ?? undefined,
    screenshots: row.screenshots,
    tracks: row.tracks,
    categories: row.categories?.length ? row.categories : undefined,
    other_category: row.other_category ?? undefined,
    tags: row.tags,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    is_winner: row.is_winner ?? undefined,
    members,
    hackathon,
    origin: row.origin,
    visibility: resolveVisibility(row.visibility),
  };

  console.log("GET project:", project.project_name);
  return project;
}

export async function createProject(
  projectData: Partial<Project>
): Promise<Project> {
  const errors = validateProject(projectData);
  console.log(errors);
  if (errors.length > 0) {
    throw new ValidationError("Validation failed", errors);
  }
  const newProject = await prisma.project.create({
    data: {
      project_name: projectData.project_name ?? "",
      short_description: projectData.short_description ?? "",
      cover_url: projectData.cover_url ?? "",
      demo_link: projectData.demo_link ?? "",
      demo_video_link: projectData.demo_video_link ?? "",
      full_description: projectData.full_description ?? "",
      github_repository: projectData.github_repository ?? "",
      logo_url: projectData.logo_url ?? "",
      screenshots: projectData.screenshots ?? [],
      tech_stack: projectData.tech_stack ?? "",
      tracks: projectData.tracks ?? [],
      hackaton_id: projectData.hackaton_id ?? null,
      visibility: resolveVisibility(projectData.visibility),
      members: {
        create: projectData.members?.map((member) => ({
          user_id: member.user_id,
          role: member.role,
          status: member.status,
        })),
      },
      created_at: new Date(),
      updated_at: new Date(),
      origin: projectData.origin ?? "",
    },
  });
  projectData.id = newProject.id;
  revalidatePath("/api/projects/");
  return projectData as Project;
}

export async function updateProject(
  id: string,
  projectData: Partial<Project>
): Promise<Project> {
  const errors = validateProject(projectData);
  console.log(errors);
  if (errors.length > 0) {
    throw new ValidationError("Validation failed", errors);
  }

  const existingProject = await prisma.project.findUnique({
    where: { id },
  });
  if (!existingProject) {
    throw new Error("Project not found");
  }

  await prisma.project.update({
    where: { id },
    data: {
      project_name: projectData.project_name ?? "",
      short_description: projectData.short_description ?? "",
      cover_url: projectData.cover_url ?? "",
      demo_link: projectData.demo_link ?? "",
      demo_video_link: projectData.demo_video_link ?? "",
      full_description: projectData.full_description ?? "",
      github_repository: projectData.github_repository ?? "",
      logo_url: projectData.logo_url ?? "",
      screenshots: projectData.screenshots ?? [],
      tech_stack: projectData.tech_stack ?? "",
      tracks: projectData.tracks ?? [],
      ...(projectData.visibility !== undefined && {
        visibility: resolveVisibility(projectData.visibility),
      }),
      members: {
        create: projectData.members?.map((member) => ({
          user_id: member.user_id,
          role: member.role,
          status: member.status,
        })),
      },
      updated_at: new Date(),
    },
  });
  revalidatePath(`/api/projects/${projectData.id}`);
  revalidatePath("/api/projects/");
  return projectData as Project;
}

export async function CheckInvitation(invitationId: string, user_id: string) {
  const user = await prisma.user.findUnique({
    where: { id: user_id },
  });
  const member = await prisma.member.findFirst({
    where: {
      OR: [
        { id: invitationId, user_id: user_id },
        { id: invitationId, email: user?.email },
      ],
      status: {
        not: "Removed",
      },
    },
    include: {
      project: true,
    },
  });

  const existingConfirmedProject = await prisma.project.findFirst({
    where: {
      members: {
        some: {
          OR: [{ user_id: user_id }, { email: user?.email }],
          status: "Confirmed",
          NOT: {
            project_id: member?.project?.id,
          },
        },
      },
      hackaton_id: member?.project?.hackaton_id,
    },
    include: {
      hackathon: true,
    },
  });

  const isValid =
    existingConfirmedProject == null &&
    member?.status == "Pending Confirmation";

  return {
    invitation: {
      isValid: !!member,
      isConfirming: isValid,
      exists: member ? true : false,
      hasConfirmedProject: !!existingConfirmedProject,
    },
    project: {
      project_id: member?.project?.id,
      project_name:
        existingConfirmedProject?.project_name ?? member?.project?.project_name,
      confirmed_project_name: existingConfirmedProject?.project_name ?? "",
      hackathon_id: member?.project?.hackaton_id ?? "",
    },
  };
}

export async function GetProjectByHackathonAndUser(
  hackaton_id: string,
  user_id: string,
  invitation_id: string
) {
  if (hackaton_id == "" || user_id == "") {
    throw new ValidationError("hackathon id or user id is required", []);
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ id: user_id }, { email: user_id }],
    },
  });

  if (!user) {
    throw new ValidationError("user not found", []);
  }
  let project_id = "";
  if (invitation_id != "") {
    const invitation = await prisma.member.findFirst({
      where: { id: invitation_id },
    });

    project_id = invitation?.project_id??"";
  }

  if(project_id!==""){
    const project = await prisma.project.findFirst({
      where: { id: project_id },
    });
    return project;
  }

  const project = await prisma.project.findFirst({
    where: {
      hackaton_id,
      members: {
        some: {
          OR: [{ user_id: user.id }, { email: user.email }],
          status: {
            in: ["Confirmed", "Pending Confirmation"],
          },
        },
      },
    },
  });

  if (!project) {
    console.log(`No project found for hackathon ${hackaton_id} and user ${user_id} - valid for new project creation`);
  }

  return project;
}


export type GetProjectOptions = {
  page?: number;
  pageSize?: number;
  search?: string;
  event?: string;
  track?: string;
  /** SPEEDRUN filters: multi-select tech-stack tokens (OR within, AND with others). */
  stack?: string[];
  /** SPEEDRUN filter: filter by team-member country (matches User.country on any member). */
  country?: string[];
  /** SPEEDRUN filter: "solo" = 1 member, "duo" = 2+ members. */
  teamType?: "solo" | "duo";
  /** SPEEDRUN: cursor-based pagination — opaque project id. */
  cursor?: string;
  /** SPEEDRUN: number of results to return when using cursor mode. */
  limit?: number;
  /** SPEEDRUN sort order. */
  sort?: "newest" | "oldest" | "name";
  winningProjects?: boolean;
};

/**
 * Gallery / partner-API read.
 *
 * Returns projects with member contact fields filtered according to each
 * member's per-field visibility flags (Member.visibility JSON). Hidden fields
 * are returned as `null`. Country filtering applies on the stored value
 * regardless of visibility (per the SPEEDRUN spec); hidden countries just
 * don't show on the response.
 *
 * Uses cursor-based pagination keyed on Project.id (opaque) for stable paging
 * under concurrent submissions. `next_cursor` is null when the page is the
 * final one.
 */
export interface GalleryMember {
  name: string;
  country: string | null;
  github: string | null;
  telegram: string | null;
  x: string | null;
  email: string | null;
}

export interface GalleryProject {
  id: string;
  name: string;
  team_name: string;
  short_description: string;
  screenshots: string[];
  repo_url: string | null;
  demo_url: string | null;
  tracks: string[];
  stack: string[];
  team: {
    name: string;
    type: "solo" | "duo";
    members: GalleryMember[];
  };
  submitted_at: string;
}

export interface GalleryResponse {
  projects: GalleryProject[];
  next_cursor: string | null;
}

const ALLOWED_VISIBILITY_FIELDS = ["country", "email", "telegram", "x", "github"] as const;
type VisibilityField = (typeof ALLOWED_VISIBILITY_FIELDS)[number];

function readVisibility(raw: unknown): Record<VisibilityField, boolean> {
  const out: Record<VisibilityField, boolean> = {
    country: false,
    email: false,
    telegram: false,
    x: false,
    github: false,
  };
  if (raw && typeof raw === "object") {
    for (const field of ALLOWED_VISIBILITY_FIELDS) {
      out[field] = Boolean((raw as Record<string, unknown>)[field]);
    }
  }
  return out;
}

export async function getProjectsForGallery(options: GetProjectOptions): Promise<GalleryResponse> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);

  const filters: any = {
    visibility: {
      in: [PROJECT_VISIBILITY.SEMI_PUBLIC, PROJECT_VISIBILITY.PUBLIC],
    },
  };
  if (options.event) filters.hackaton_id = options.event;
  if (options.track) filters.tracks = { has: options.track };
  if (options.stack && options.stack.length > 0) filters.stack = { hasSome: options.stack };
  if (options.country && options.country.length > 0) {
    filters.members = {
      some: {
        status: "Confirmed",
        user: { country: { in: options.country } },
      },
    };
  }
  if (options.winningProjects) filters.is_winner = true;
  if (options.search) {
    const word = options.search.trim();
    if (word) {
      filters.OR = [
        { project_name: { contains: word, mode: "insensitive" } },
        { full_description: { contains: word, mode: "insensitive" } },
        { tracks: { has: word } },
      ];
    }
  }

  const orderBy =
    options.sort === "oldest"
      ? { created_at: "asc" as const }
      : options.sort === "name"
        ? { project_name: "asc" as const }
        : { created_at: "desc" as const };

  // Fetch one extra row so we know whether there's a next page.
  const rows = await prisma.project.findMany({
    where: filters,
    include: {
      members: {
        where: { status: "Confirmed" },
        include: { user: true },
      },
    },
    orderBy: [orderBy, { id: "desc" as const }],
    take: limit + 1,
    ...(options.cursor && {
      cursor: { id: options.cursor },
      skip: 1,
    }),
  });

  let hasNext = rows.length > limit;
  let pageRows = hasNext ? rows.slice(0, limit) : rows;

  // Team-type filter is applied post-query because Prisma can't express
  // "exactly one confirmed member" cleanly. Acceptable for galleries with a
  // bounded page size.
  if (options.teamType) {
    pageRows = pageRows.filter((p) =>
      options.teamType === "solo"
        ? p.members.length <= 1
        : p.members.length >= 2,
    );
    // If we filtered, hasNext might be stale; we still surface next_cursor
    // when we got `limit+1` raw rows so the client can keep paging.
  }

  const projects: GalleryProject[] = pageRows.map((p) => {
    const teamType: "solo" | "duo" = p.members.length >= 2 ? "duo" : "solo";
    const galleryMembers: GalleryMember[] = p.members.map((m) => {
      const v = readVisibility(m.visibility as unknown);
      const u = m.user;
      return {
        name: u?.name ?? "Anonymous",
        country: v.country ? (u?.country ?? null) : null,
        github: v.github ? (u?.github_account ?? null) : null,
        telegram: v.telegram ? (u?.telegram_account ?? null) : null,
        x: v.x ? (u?.x_account ?? null) : null,
        email: v.email ? (u?.email ?? null) : null,
      };
    });

    const teamName = p.project_name;
    const repoUrl = p.github_repository ? p.github_repository.split(",")[0] : null;
    const demoUrl = p.demo_link ? p.demo_link.split(",")[0] : null;

    return {
      id: p.id,
      name: p.project_name,
      team_name: teamName,
      short_description: p.short_description,
      screenshots: p.screenshots ?? [],
      repo_url: repoUrl,
      demo_url: demoUrl,
      tracks: p.tracks ?? [],
      stack: (p as any).stack ?? [],
      team: {
        name: teamName,
        type: teamType,
        members: galleryMembers,
      },
      submitted_at: p.created_at.toISOString(),
    };
  });

  const nextCursor = hasNext && pageRows.length > 0 ? pageRows[pageRows.length - 1].id : null;

  return {
    projects,
    next_cursor: nextCursor,
  };
}