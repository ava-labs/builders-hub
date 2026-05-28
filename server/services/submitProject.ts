import {
  hasAtLeastOne,
  requiredField,
  validateEntity,
  Validation,
} from "./base";
import { REQUIRED_SUBMISSION_FIELDS, fieldComplete } from "@/lib/hackathons/submission-progress";
import { revalidatePath } from "next/cache";
import { ValidationError } from "./hackathons";
import { prisma } from "@/prisma/prisma";
import { Project } from "@/types/project";
import { Prisma, User } from "@prisma/client";
import { sendSubmissionConfirmationMail } from "./registerForms";

/** Returns true when all required submission fields are filled in. */
export function isProjectComplete(p: Partial<Project>): boolean {
  return REQUIRED_SUBMISSION_FIELDS.every((field) =>
    fieldComplete(p[field as keyof typeof p])
  );
}

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

// Type guard to check if a value is a non-empty object
const isNonEmptyObject = (value: unknown): value is Record<string, unknown> => {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  );
};

// Helper function to normalize deployed_addresses from JsonValue[] to Array<{ address: string; tag?: string }>
function normalizeDeployedAddresses(
  addresses: any
): Array<{ address: string; tag?: string }> {
  if (!addresses) return [];
  if (!Array.isArray(addresses)) return [];
  
  return addresses
    .filter((item): item is { address: string; tag?: string } => {
      return (
        item &&
        typeof item === 'object' &&
        'address' in item &&
        typeof item.address === 'string' &&
        item.address.trim().length > 0 &&
        (!item.tag || typeof item.tag === 'string')
      );
    })
    .map((item) => ({
      address: item.address.trim(),
      ...(item.tag && item.tag.trim().length > 0 ? { tag: item.tag.trim() } : {}),
    }));
}

type RawMemberRow = {
  id: string;
  role: string;
  status: string;
  email: string;
  user: { id: string; name: string | null; email: string } | null;
};

export type ProjectCreateResult = Omit<Project, "members"> & {
  members: Array<{ id: string; role: string; status: string; name: string | null; email: string | null }>;
};

const memberInclude = {
  members: {
    select: {
      id: true,
      role: true,
      status: true,
      email: true,
      user: { select: { id: true, name: true, email: true } },
    },
  },
} as const;

export async function createProject(
  projectData: Partial<Project>
): Promise<ProjectCreateResult> {
  const isDraft = projectData.isDraft ?? false;

  // Atomic transaction to prevent race conditions and duplication
  const savedProject = await prisma.$transaction(async (tx) => {
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

    // Re-check immediately before creating to narrow the concurrent-read race window.
    // Two transactions can both reach here having found no existing project; the
    // second findFirst after both reads closes the window before the write.
    if (!existingProject && projectData.hackaton_id) {
      existingProject = await tx.project.findFirst({
        where: {
          hackaton_id: projectData.hackaton_id,
          members: {
            some: { user_id: projectData.user_id, status: "Confirmed" },
          },
        },
        include: { members: true },
      });
    }

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
          deployed_addresses: normalizeDeployedAddresses(projectData.deployed_addresses),
          website: isNonEmptyObject(projectData.website)
            ? projectData.website
            : Prisma.JsonNull,
          socials: isNonEmptyObject(projectData.socials)
            ? projectData.socials
            : Prisma.JsonNull,
          ...(typeof projectData.consent_sharing === "boolean"
            ? { consent_sharing: projectData.consent_sharing }
            : {}),
        },
        include: memberInclude,
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
        deployed_addresses: normalizeDeployedAddresses(projectData.deployed_addresses),
        website: isNonEmptyObject(projectData.website)
          ? projectData.website
          : Prisma.JsonNull,
        socials: isNonEmptyObject(projectData.socials)
          ? projectData.socials
          : Prisma.JsonNull,
        ...(typeof projectData.consent_sharing === "boolean"
          ? { consent_sharing: projectData.consent_sharing }
          : {}),
        explanation: projectData.explanation ?? "",
        origin: "Project submission",
        // Note: hackaton_id is handled via the hackathon relation below, not directly
        // Member created together with project
        members: {
          create: {
            user_id: projectData.user_id as string,
            role: "Member",
            status: "Confirmed",
            email: (await tx.user.findUnique({
              where: { id: projectData.user_id as string },
              select: { email: true },
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
        include: memberInclude,
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

  // Send submission confirmation email once, outside the transaction,
  // when this is a final submit (not a draft save) and all required fields
  // are filled and the email hasn't been sent yet.
  if (
    !isDraft &&
    isProjectComplete(projectData) &&
    savedProject.hackaton_id &&
    projectData.submittedBy &&
    !savedProject.submission_email_sent
  ) {
    try {
      await prisma.project.update({
        where: { id: savedProject.id },
        data: { submission_email_sent: true },
        select: { id: true },
      });
      await sendSubmissionConfirmationMail(
        projectData.submittedBy as string,
        savedProject.project_name,
        savedProject.hackaton_id,
      );
    } catch (err) {
      console.error("[Submission email] Failed to send:", err);
    }
  }

  const rawMembers = (savedProject as unknown as { members?: RawMemberRow[] }).members ?? [];
  const members = rawMembers.map((m) => ({
    id: m.id,
    role: m.role,
    status: m.status,
    name: m.user?.name ?? null,
    email: m.user?.email ?? m.email ?? null,
  }));

  return { ...(savedProject as unknown as Project), members } as ProjectCreateResult;
}

function normalizeUser(user: Partial<User>): User {
  return {
    id: user.id ?? "",
    name: user.name ?? null,
    email: user.email ?? "",
    telegram_account: user.telegram_account ?? null,
    image: user.image ?? null,
    authentication_mode: user.authentication_mode ?? null,
    integration: user.integration ?? null,
    last_login: user.last_login ?? null,
    notification_email: user.notification_email ?? null,
    user_name: user.user_name ?? null,
    custom_attributes: user.custom_attributes ?? [],
    bio: user.bio ?? null,
    profile_privacy: user.profile_privacy ?? null,
    additional_social_accounts: user.additional_social_accounts ?? [],
    notifications: user.notifications ?? null,
    created_at: user.created_at ?? new Date(),
    country: user.country ?? null,
    user_type: user.user_type ?? null,
    github_account: user.github_account ?? null,
    x_account: user.x_account ?? null,
    linkedin_account: user.linkedin_account ?? null,
    wallet: user.wallet ?? [],
    skills: user.skills ?? [],
    team_id: user.team_id ?? null,
    noun_avatar_seed: user.noun_avatar_seed ?? null,
    noun_avatar_enabled: user.noun_avatar_enabled ?? false,
  } as unknown as User;
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
    deployed_addresses: normalizeDeployedAddresses(projectData.deployed_addresses),
    is_winner: false,

    members: projectData.members?.map((member) => {
      const user = member.user;
      return {
        ...normalizeUser(member.user as Partial<User>),
        id: user?.id ?? "",
        name: user?.name ?? null,
        email: user?.email ?? member.email ?? "",
        telegram_account: user?.telegram_account ?? null,
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
