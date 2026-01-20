import {
  hasAtLeastOne,
  requiredField,
  validateEntity,
  Validation,
} from "./base";
import { revalidatePath } from "next/cache";
import { ValidationError } from "./hackathons";
import { prisma } from "@/prisma/prisma";
import { Project } from "@/types/project";
import { User } from "@prisma/client";

export const projectValidations: Validation[] = [
  {
    field: "project_name",
    message: "Project name is required.",
    validation: (project: Project) => requiredField(project, "project_name"),
  },
  {
    field: "short_description",
    message: "Short description is required.",
    validation: (project: Project) =>
      requiredField(project, "short_description"),
  },
  // hackaton_id is optional - removed from required validations
  // tracks is optional - removed from required validations
];

export const validateProject = (projectData: Partial<Project>): Validation[] =>
  validateEntity(projectValidations, projectData);

// Helper function to normalize categories from string or string[] to string[]
function normalizeCategories(categories: string | string[] | undefined): string[] {
  if (Array.isArray(categories)) {
    return categories;
  }
  if (typeof categories === 'string') {
    return categories.split(',').filter(Boolean);
  }
  return [];
}

export async function createProject(
  projectData: Partial<Project>
): Promise<Project> {
  // Atomic transaction to prevent race conditions and duplication
  return await prisma.$transaction(async (tx) => {
    const isDraft = projectData.isDraft ?? false;
    if (!isDraft) {
      const errors = validateProject(projectData);
      console.log("errors", errors);
      if (errors.length > 0) {
        throw new ValidationError("Project validation failed", errors);
      }
    }

    //Find existing project WITHIN transaction
    // Priority: 
    // 1. If projectData.id exists, search by that specific ID (editing existing project)
    // 2. If no ID but has hackathon_id, search by hackathon + user (hackathon projects)
    // 3. If no ID and no hackathon_id, create new project directly (standalone projects)
    let existingProject = null;
    
    if (projectData.id) {
      // If we have a project ID, search by that specific ID (editing mode)
      existingProject = await tx.project.findFirst({
        where: {
          id: projectData.id,
          members: {
            some: {
              user_id: projectData.user_id,
              status: "Confirmed",
            },
          },
        },
        include: {
          members: true,
        },
      });
    } else if (projectData.hackaton_id) {
      // Only search by hackathon/user if we have a hackathon_id (hackathon projects)
      // This prevents creating duplicate projects for the same hackathon
      const whereClause: any = {
        hackaton_id: projectData.hackaton_id,
        members: {
          some: {
            user_id: projectData.user_id,
            status: "Confirmed",
          },
        },
      };
      
      existingProject = await tx.project.findFirst({
        where: whereClause,
        include: {
          members: true,
        },
      });
    }
    // If no ID and no hackathon_id, existingProject remains null and we create a new project

    if (existingProject) {
      // Update existing project
      const updatedProject = await tx.project.update({
        where: { id: existingProject.id },
        data: {
          project_name: projectData.project_name ?? "",
          short_description: projectData.short_description ?? "",
          full_description: projectData.full_description ?? "",
          tech_stack: projectData.tech_stack ?? "",
          github_repository: projectData.github_repository ?? "",
          demo_link: projectData.demo_link ?? "",
          explanation: projectData.explanation ?? "",
          is_preexisting_idea: projectData.is_preexisting_idea ?? false,
          logo_url: projectData.logo_url ?? "",
          cover_url: projectData.cover_url ?? "",
          demo_video_link: projectData.demo_video_link ?? "",
          screenshots: projectData.screenshots ?? [],
          tracks: projectData.tracks ?? [],
          categories: normalizeCategories(projectData.categories),
          other_category: projectData.other_category ?? null,
        },
      });

      projectData.id = updatedProject.id;
      revalidatePath("/api/projects/");
      return updatedProject as unknown as Project;
    } else {
      // Create new project AND member atomically
      const projectDataToCreate: any = {
        project_name: projectData.project_name ?? "",
        short_description: projectData.short_description ?? "",
        full_description: projectData.full_description ?? "",
        tech_stack: projectData.tech_stack ?? "",
        github_repository: projectData.github_repository ?? "",
        demo_link: projectData.demo_link ?? "",
        is_preexisting_idea: projectData.is_preexisting_idea ?? false,
        logo_url: projectData.logo_url ?? "",
        cover_url: projectData.cover_url ?? "",
        demo_video_link: projectData.demo_video_link ?? "",
        screenshots: projectData.screenshots ?? [],
        tracks: projectData.tracks ?? [],
        categories: normalizeCategories(projectData.categories),
        other_category: projectData.other_category ?? null,
        explanation: projectData.explanation ?? "",
        origin: "Project submission",
        hackaton_id: projectData.hackaton_id ?? null,
        // Member created together with project
        members: {
          create: {
            user_id: projectData.user_id as string,
            role: "Member",
            status: "Confirmed",
            email: (await tx.user.findUnique({
              where: { id: projectData.user_id as string },
            }))?.email ?? "",
          },
        },
      };
      
      // Only connect to hackathon if hackaton_id is provided
      if (projectData.hackaton_id) {
        projectDataToCreate.hackathon = {
          connect: { id: projectData.hackaton_id },
        };
      }
      
      const newProjectData = await tx.project.create({
        data: projectDataToCreate,
      });

      projectData.id = newProjectData.id;
      revalidatePath("/api/projects/");
      return newProjectData as unknown as Project;
    }
  }, {
    // Transaction configuration for better performance
    maxWait: 5000, // Maximum 5 seconds waiting for lock
    timeout: 10000, // Maximum 10 seconds executing transaction
  });
}

function normalizeUser(user: Partial<User>): User {
  return {
    id: user.id ?? "",
    name: user.name ?? null,
    email: user.email ?? null,
    telegram_user: user.telegram_user ?? null,
    image: user.image ?? null,
    authentication_mode: user.authentication_mode ?? null,
    integration: user.integration ?? null,
    last_login: user.last_login ?? null,
    notification_email: user.notification_email ?? null,
    user_name: user.user_name ?? null,
    custom_attributes: user.custom_attributes ?? [],
    bio: user.bio ?? null,
    profile_privacy: user.profile_privacy ?? null,
    social_media: user.social_media ?? [],
    notifications: user.notifications ?? null,
    created_at: user.created_at ?? new Date(),
    country: user.country ?? null,
    user_type: user.user_type ?? null,
    github: user.github ?? null,
    wallet: user.wallet ?? [],
    skills: user.skills ?? [],
    noun_avatar_seed: user.noun_avatar_seed ?? null,
    noun_avatar_enabled: user.noun_avatar_enabled ?? false,
  };
}
export async function getProject(projectId: string): Promise<Project | null> {
  const projectData = await prisma.project.findUnique({
    where: {
      id: projectId,
    },
    include: {
      hackathon: true,
      members: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!projectData) return null;

  const project: Project = {
    id: projectData.id,
    hackaton_id: projectData.hackaton_id ?? undefined,
    project_name: projectData.project_name,
    short_description: projectData.short_description,
    full_description: projectData.full_description ?? undefined,
    tech_stack: projectData.tech_stack ?? undefined,
    github_repository: projectData.github_repository ?? undefined,
    demo_link: projectData.demo_link ?? undefined,
    is_preexisting_idea: projectData.is_preexisting_idea,
    logo_url: projectData.logo_url ?? undefined,
    cover_url: projectData.cover_url ?? undefined,
    demo_video_link: projectData.demo_video_link ?? undefined,
    screenshots: projectData.screenshots ?? undefined,
    tracks: projectData.tracks,
    categories: normalizeCategories(projectData.categories),
    other_category: projectData.other_category ?? undefined,
    is_winner: false,

    members: projectData.members?.map((member) => {
      const user = member.user;
      return {
        ...normalizeUser(member.user as Partial<User>),
        id: user?.id ?? "",
        name: user?.name ?? null,
        email: user?.email ?? null,
        telegram_user: user?.telegram_user ?? null,
        image: user?.image ?? null,
        custom_attributes: user?.custom_attributes ?? [],
        authentication_mode: user?.authentication_mode ?? "",
        role: member.role,
        status: member.status,
      };
    }),
  };

  return project;
}
