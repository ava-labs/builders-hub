import { Project, ProjectHackathonInfo, ProjectMemberUser } from "@/types/showcase";
import { PrismaClient } from "@prisma/client";
import { validateEntity, Validation } from "./base";
import { revalidatePath } from "next/cache";

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

  let filters: any = {};

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
      prizes: true,
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
    projects: projects.map((project) => ({
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
    })),
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
      prizes: true,
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
    prizes: row.prizes.map((p) => ({
      icon: p.icon,
      prize: p.prize,
      track: p.track,
    })),
    hackathon,
    origin: row.origin,
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
      // prizes: {
      //   create: projectData.prizes?.map((prize) => ({
      //     icon: prize.icon,
      //     prize: prize.prize,
      //     track: prize.track,
      //   })),
      // },
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
      members: {
        create: projectData.members?.map((member) => ({
          user_id: member.user_id,
          role: member.role,
          status: member.status,
        })),
      },
      // prizes: {
      //   create: projectData.prizes?.map((prize) => ({
      //     icon: prize.icon,
      //     prize: prize.prize,
      //     track: prize.track,
      //   })),
      // },
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
  winningProjects?: boolean;
};