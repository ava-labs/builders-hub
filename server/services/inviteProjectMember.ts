import { prisma } from "@/prisma/prisma";
import { sendInvitation } from "./SendInvitationProjectMember";


export async function generateInvitation(
  hackathonId: string,
  userId: string,
  inviterName: string
) {
  const member = await prisma.member.findFirst({
    where: {
      user_id: userId,
      project: {
        hackathon: {
          id: hackathonId,
        },
      },
    },
    include: {
      user: true,
      project: true,
    },
  });

  if (!member) {
    throw new Error("Member not found");
  }

  if (!member.user || !member.user.email) {
    throw new Error("User email not found");
  }

  if (!member.project) {
    throw new Error("Project not found");
  }

  // Construimos el magic link utilizando la URL base de la app y los parámetros necesarios
  const baseUrl = process.env.NEXTAUTH_URL as string;
  const inviteLink = `${baseUrl}/hackathons/project-submission?hackathonId=${hackathonId}&invitationId=${member.id}`;

  // Enviamos la invitación utilizando la función sendInvitation
  await sendInvitation(
    member.user.email,
    member.project.project_name,
    inviterName,
    inviteLink
  );

  return inviteLink;
}
