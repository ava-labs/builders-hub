import { prisma } from "@/prisma/prisma";

import { ValidationError } from "./hackathons";
import { MemberStatus } from "@/types/project";

export async function UpdateStatusMember(
  user_id: string,
  project_id: string,
  status: string,
  email: string,
  wasInOtherProject: boolean
) {
  if (!user_id || !project_id || !status) {
    throw new ValidationError("user_id and project_id are required", []);
  }

  const user = await prisma.user.findUnique({
    where: {
      id: user_id,
    },
  });



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

  if(!member.user_id){
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
  console.log("wasInOtherProject",wasInOtherProject)
  console.log("member",member)
  console.log("project_id",project_id)

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
  }));
}

export async function UpdateRoleMember(member_id: string, role: string) {
  const updatedMember = await prisma.member.update({
    where: { id: member_id },
    data: { role },
  });
  return updatedMember;
}