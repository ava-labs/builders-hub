import { Project } from "@/types/showcase";
import { Prisma, PrismaClient } from "@prisma/client";
import { requiredField, validateEntity, Validation } from "./base";
import { revalidatePath } from "next/cache";

const prisma = new PrismaClient();

export const projectValidations: Validation[] = [
  { field: "name", message: "Please provide a name for the project.", validation: (project: Project) => requiredField(project, "title") },
];

export const validateHackathon = (project: Partial<Project>): Validation[] => validateEntity(projectValidations, project);

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
        title: {
          contains: word, mode: "insensitive",
        },
      },
      {
        location: {
          contains: word, mode: "insensitive"
        },
      },
      {
        description: {
          contains: word, mode: "insensitive"
        },
      },
      ]
    })
    searchFilters = [...searchFilters,
    {
      tags: {
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

  const hackathonList = await prisma.hackathon.findMany({
    where: filters,
    skip: offset,
    take: pageSize,
  });

  const hackathons = hackathonList
  let hackathonsLite = hackathons

  const totalHackathons = await prisma.hackathon.count({
    where: filters,
  });

  return {
    hackathons: hackathonsLite.map((hackathon) => ({
      total: totalHackathons,
      page,
      pageSize,
    }))
  }
}

export async function getProject(id: string) {

    const hackathon = await prisma.hackathon.findUnique({
        where: { id },
    });
    if (!hackathon)
        throw new Error("Project not found", { cause: "BadRequest" });

    const hackathonContent = hackathon.content as unknown as Hackathon
    return {
        ...hackathon,
        content: hackathonContent,
    } as Project 
}

export async function createProject(projectData: Partial<Project>): Promise<Project> {
  const errors = validateHackathon(projectData);
  console.log(errors)
  if (errors.length > 0) {
    throw new ValidationError("Validation failed", errors)
  }

  const content = { ...projectData} as Prisma.JsonObject
  const newHackathon = await prisma.hackathon.create({
    data: {
    },
  });
  projectData.id = newHackathon.id;
  revalidatePath('/api/projects/')
  return projectData as Project;
}

export async function updateProject(id: string, projectData: Partial<Project>): Promise<Project> {
    const errors = validateHackathon(projectData);
    console.log(errors)
    if (errors.length > 0) {
        throw new ValidationError("Validation failed", errors)
    }

    const existingHackathon = await prisma.hackathon.findUnique({
        where: { id },
    });
    if (!existingHackathon) {
        throw new Error("Hackathon not found")
    }

    await prisma.hackathon.update({
        where: { id },
        data: {
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