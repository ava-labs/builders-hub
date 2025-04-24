import { prisma } from "@/prisma/prisma";

import { ValidationError } from "./hackathons";

export async function UpdateStatusMember(
  user_id: string,
  project_id: string,
  status: string
) {
  if (!user_id || !project_id || !status) {
    throw new ValidationError("user_id and project_id are required", []);
  }
  const updatedMember = await prisma.member.update({
    where: {
      user_id_project_id: {
        user_id: user_id as string,
        project_id: project_id as string,
      },
    },
    data: { status: status },
  });
  return updatedMember;
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

export async function UpdateRoleMember(member_id:string,role:string){
    const updatedMember = await prisma.member.update({
        where: { id: member_id },
        data: { role },
      });
  return updatedMember;
}