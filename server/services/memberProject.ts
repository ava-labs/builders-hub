import { prisma } from "@/prisma/prisma";

import { ValidationError } from "./hackathons";
import { MemberStatus } from "@/types/project";

export async function UpdateStatusMember(
  user_id: string | undefined,
  project_id: string,
  status: string,
  email: string,
  wasInOtherProject: boolean
) {  
  if (!project_id || !status) {
    throw new ValidationError("project_id and status are required", []);
  }

  // Buscar el usuario si se proporciona user_id
  const user = user_id ? await prisma.user.findFirst({
    where: {
      OR: [
        { id: user_id },
        { email: email }
      ]
    }
  }) : null;
 
  const member = await prisma.member.findFirst({
    where: {
      OR: [
        { user_id: user_id },
        { email: user?.email },
        { email: email }
      ],
      project_id: project_id
    }
  });
  
  if (!member) {
    throw new ValidationError("Member not found", []);
  }

  const updatedMember = await prisma.member.update({
    where: {
      id: member.id,
      project_id: project_id
    },
    data: { status: status },
  });
  

  if (user_id && user_id !== member.user_id) {
    await prisma.member.update({
      where: {
        id: member.id,
      },
      data: { user_id: user_id }
    });
  }

  checkIfUserIsMemberOfOtherProject(wasInOtherProject, member, project_id);

  return updatedMember;
}

async function checkIfUserIsMemberOfOtherProject(wasInOtherProject: boolean, member: any, project_id: string) {

  if (wasInOtherProject) {
    const currentProject = await prisma.project.findUnique({
      where: {
        id: project_id,
      },
    });

    const allProjects = await prisma.project.findMany({
      where: {
        hackaton_id: currentProject!.hackaton_id,
        AND: {
          id: { not: project_id }
        }
      },
      select: {
        id: true,
      },
    });

    const projectIds = allProjects.map(p => p.id);

    await prisma.member.updateMany({
      where: {
        project_id: {
          in: projectIds,
        },
        AND: {
          OR: [
            { user_id: member.user_id },
            { email: member.email }
          ]
        }
      },
      data: { status: MemberStatus.REMOVED }
    });

    for (const projectId of projectIds) {
      await deleteProjectIfNoMembers(projectId);
    }
  }
}

async function deleteProjectIfNoMembers(projectId: string) {
  const remainingMembers = await prisma.member.findMany({
    where: {
      project_id: projectId,    
      status: { not: MemberStatus.REMOVED }
    }
  });

  if (remainingMembers.length === 0) {
    await prisma.project.delete({
      where: {
        id: projectId
      }
    });
  }
}

export async function GetMembersByProjectId(project_id: string) {
  // Lazy teammate auto-conversion: when the hackathon's registration_deadline has passed,
  // any still-pending Member row is converted to "Removed" so the team effectively becomes
  // solo. Avoids a scheduled job; this is the read path the submission form uses.
  try {
    const project = await prisma.project.findUnique({
      where: { id: project_id },
      select: { hackathon: { select: { content: true } } },
    });
    const registrationDeadlineRaw =
      (project?.hackathon?.content as any)?.registration_deadline ?? null;
    if (registrationDeadlineRaw) {
      const deadline = new Date(registrationDeadlineRaw);
      if (Number.isFinite(deadline.getTime()) && Date.now() > deadline.getTime()) {
        await prisma.member.updateMany({
          where: { project_id, status: "Pending Confirmation" },
          data: { status: "Removed" },
        });
      }
    }
  } catch (err) {
    // Don't block the read if the lazy conversion fails.
    console.error("[Members] Lazy pending-teammate cleanup failed:", err);
  }

  const members = await prisma.member.findMany({
    where: { project_id: project_id, status: { not: "Removed" } },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  return members.map((member) => ({
    id: member.id,
    user_id: member.user_id,
    name: member.user?.name,
    email: member.user?.email ?? member.email,
    image: member.user?.image,
    role: member.role,
    status: member.status,
    visibility: member.visibility ?? null,
  }));
}

export async function UpdateRoleMember(member_id: string, role: string) {
  const updatedMember = await prisma.member.update({
    where: { id: member_id },
    data: { role },
  });
  return updatedMember;
}

export type MemberVisibility = {
  country?: boolean;
  email?: boolean;
  telegram?: boolean;
  x?: boolean;
  github?: boolean;
};

/**
 * Update a member's per-field contact-visibility toggles. Only the member
 * themselves should be able to call this (enforced in the route handler).
 */
export async function UpdateMemberVisibility(
  member_id: string,
  visibility: MemberVisibility,
) {
  // Whitelist + coerce to booleans so we never store arbitrary client JSON.
  const safe: MemberVisibility = {
    country: Boolean(visibility.country),
    email: Boolean(visibility.email),
    telegram: Boolean(visibility.telegram),
    x: Boolean(visibility.x),
    github: Boolean(visibility.github),
  };
  return prisma.member.update({
    where: { id: member_id },
    data: { visibility: safe },
  });
}

export async function GetProjectsByUserId(user_id: string) {
  const projects = await prisma.project.findMany({
    where: { members: { some: { user_id: user_id } } },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              bio: true,
              additional_social_accounts: true,
              telegram_account: true,
              image: true,
              user_name: true,
            },
          },
        },
      },
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
  });

  // Transform badges to match the expected format
  return projects.map((project) => ({
    ...project,
    badges: project.badges?.map((projectBadge: any) => ({
      ...projectBadge,
      name: projectBadge.badge.name,
      image_path: projectBadge.badge.image_path,
    })),
  }));
}

export async function GetProjectByIdWithMembers(project_id: string) {
  const project = await prisma.project.findUnique({
    where: { id: project_id },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              bio: true,
              additional_social_accounts: true,
              telegram_account: true,
              image: true,
              user_name: true,
            },
          },
        },
      },
    },
  });
  return project;
}