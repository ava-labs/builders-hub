import { prisma } from "@/prisma/prisma";
import { sendInvitation } from "./SendInvitationProjectMember";
import { getUserByEmail } from "./getUser";

export async function generateInvitation(
  hackathonId: string,
  userId: string,
  inviterName: string,
  emails: string[]
) {
  if (!hackathonId) {
    throw new Error("Hackathon ID is required");
  }

  const existingProject = await prisma.project.findFirst({
    where: {
      hackaton_id: hackathonId,
      members: {
        some: {
          user_id: userId,
        },
      },
    },
  });

  let project;
  if (existingProject) {
    project = existingProject;
  } else {

    project = await prisma.project.create({
      data: {
        hackaton_id: hackathonId,
        project_name: "Untitled Project",
        short_description: "",
        full_description: "",
        tech_stack: "",
        github_repository: "",
        demo_link: "",
        is_preexisting_idea: false,
        logo_url: "",
        cover_url: "",
        demo_video_link: "",
        screenshots: [],
        tracks: [],
        explanation: "",
      },
    });

    await prisma.member.create({
      data: {
        user_id: userId,
        project_id: project.id,
        role: "Member", 
        status: "Confirmed",
      },
    });
  }

  for (const email of emails) {

    const invitedUser = await getUserByEmail(email);
    if(!invitedUser){
      throw new Error(`User with email ${email} not found`);
    }
    if(invitedUser.id===userId){
      continue
    }

    const existingMember = await prisma.member.findUnique({
      where: {
        user_id_project_id: {
          user_id: invitedUser.id,
          project_id: project.id,
        },
      },
    });
    if (existingMember && existingMember.status === "Confirmed") {
      continue;
    }

    const member = await prisma.member.upsert({
      where: {
        user_id_project_id: {
          user_id: invitedUser.id,
          project_id: project.id,
        },
      },
      update: { role: "Member", status: "Pending Confirmation" },
      create: {
        user_id: invitedUser.id,
        project_id: project.id,
        role: "Member",
        status: "Pending Confirmation",
      },
    });


    const baseUrl = process.env.NEXTAUTH_URL as string;
    const inviteLink = `${baseUrl}/hackathons/project-submission?hackaId=${hackathonId}&invitationId=${member.id}#team`;

    await sendInvitation(
      invitedUser.email!,
      project.project_name,
      inviterName,
      inviteLink
    );
  }
}
