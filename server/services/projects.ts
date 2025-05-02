import { Project } from "@/types/showcase";
import { Hackathon, PrismaClient, User } from "@prisma/client";
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
  // if (options.winningProjects) {
  //   filters.winningProjects = true
  // }
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
      hackathon: {
        ...project.hackathon,
        content: project.hackathon.content as any,
      },
    })),
    total: totalProjects,
    page,
    pageSize,
  };
};

export async function getProject(id: string) {
  let project = await prisma.project.findUnique({
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
  if (!project) throw new Error("Project not found", { cause: "BadRequest" });

  project = {
    ...project,
    members: project.members.map((member) => ({
      ...member,
      user: {
        user_name: member.user?.name || "",
        image: member.user?.image,
      } as User,
    })),
    hackathon: {
      title: project.hackathon.title,
      location: project.hackathon.location,
      start_date: project.hackathon.start_date,
    } as Hackathon,
  };

  console.log("GET project:", project);

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
      hackaton_id: projectData.hackaton_id ?? "",
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
    throw new ValidationError("project not found", []);
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
