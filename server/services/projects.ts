import { Project } from "@/types/showcase";
import { PrismaClient } from "@prisma/client";
import { requiredField, validateEntity, Validation } from "./base";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

export const projectValidations: Validation[] = [
  // { field: "project_name", message: "Please provide a name for the project.", validation: (project: Project) => requiredField(project, "title") },
];

export const validateProject = (project: Partial<Project>): Validation[] => validateEntity(projectValidations, project);

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
  if (options.page && options.page < 1 || options.pageSize && options.pageSize < 1)
    throw new Error("Pagination params invalid", { cause: "BadRequest" });

  console.log('GET hackathons with options:', options);
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 10;
  const offset = (page - 1) * pageSize;

  let filters: any = {};
  if (options.search) {
    const searchWords = options.search.split(/\s+/)
    let searchFilters: any[] = []
    searchWords.forEach((word) => {
      searchFilters = [...searchFilters,
      {
        project_name: {
          contains: word, mode: "insensitive",
        },
      },
      {
        full_description: {
          contains: word, mode: "insensitive"
        },
      },
      ]
    })
    searchFilters = [...searchFilters,
    {
      tracks: {
        has: options.search
      },
    },
    ]

    filters = {
      ...filters,
      OR: searchFilters
    }
  }
  console.log('Filters: ', filters)

  const projects = await prisma.project.findMany({
    include: {
      members: true,
      hackathon: true,
    },
    where: filters,
    skip: offset,
    take: pageSize,
  });

  const totalProjects = await prisma.project.count({
    where: filters,
  });

  return {
    projects: projects,
    total: totalProjects,
    page,
    pageSize,
  }
}

export async function getProject(id: string) {

  const project = await prisma.project.findUnique({
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
  if (!project)
    throw new Error("Project not found", { cause: "BadRequest" });

  return project
}

export async function createProject(projectData: Partial<Project>): Promise<Project> {
  const errors = validateProject(projectData);
  console.log(errors)
  if (errors.length > 0) {
    throw new ValidationError("Validation failed", errors)
  }
  const newProject = await prisma.project.create({
    data: {
      project_name: projectData.project_name ?? '',
      short_description: projectData.short_description ?? '',
      cover_url: projectData.cover_url ?? '',
      demo_link: projectData.demo_link ?? '',
      demo_video_link: projectData.demo_video_link ?? '',
      full_description: projectData.full_description ?? '',
      github_repository: projectData.github_repository ?? '',
      logo_url: projectData.logo_url ?? '',
      open_source: projectData.open_source ?? false,
      screenshots: projectData.screenshots ?? [],
      tech_stack: projectData.tech_stack ?? '',
      tracks: projectData.tracks ?? [],
      hackaton_id: projectData.hackaton_id ?? '',
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
  revalidatePath('/api/projects/')
  return projectData as Project;
}

export async function updateProject(id: string, projectData: Partial<Project>): Promise<Project> {
  const errors = validateProject(projectData);
  console.log(errors)
  if (errors.length > 0) {
    throw new ValidationError("Validation failed", errors)
  }

  const existingProject = await prisma.project.findUnique({
    where: { id },
  });
  if (!existingProject) {
    throw new Error("Project not found")
  }

  await prisma.project.update({
    where: { id },
    data: {
      project_name: projectData.project_name ?? '',
      short_description: projectData.short_description ?? '',
      cover_url: projectData.cover_url ?? '',
      demo_link: projectData.demo_link ?? '',
      demo_video_link: projectData.demo_video_link ?? '',
      full_description: projectData.full_description ?? '',
      github_repository: projectData.github_repository ?? '',
      logo_url: projectData.logo_url ?? '',
      open_source: projectData.open_source ?? false,
      screenshots: projectData.screenshots ?? [],
      tech_stack: projectData.tech_stack ?? '',
      tracks: projectData.tracks ?? [],
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
  revalidatePath(`/api/projects/${projectData.id}`)
  revalidatePath('/api/projects/')
  return projectData as Project;
}

export type GetProjectOptions = {
  page?: number;
  pageSize?: number;
  search?: string;
  events?: string;
}