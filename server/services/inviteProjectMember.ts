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

  const project = await createProject(hackathonId, userId);
  
  for (const email of emails) {
    await handleEmailInvitation(
      email,
      userId,
      project,
      hackathonId,
      inviterName
    );
  }
}

async function handleEmailInvitation(
  email: string,
  userId: string,
  project: any,
  hackathonId: string,
  inviterName: string
) {
  const invitedUser = await getUserByEmail(email);

  if (isSelfInvitation(invitedUser, userId)) {

    return;
  }

  const existingMember = await findExistingMember(
    invitedUser,
    email,
    project.id
  );

  if (isConfirmedMember(existingMember)) {
    return;
  }

  const member = await createOrUpdateMember(
    invitedUser,
    email,
    project.id,
    existingMember
  );
  await sendInvitationEmail(member, email, project, hackathonId, inviterName);
}

function isSelfInvitation(invitedUser: any, userId: string): boolean {
  return invitedUser?.id === userId;
}

async function findExistingMember(
  invitedUser: any,
  email: string,
  projectId: string
) {
  if (invitedUser) {
    const member = await prisma.member.findFirst({
      where: {
        user_id: invitedUser?.id,
        project_id: projectId,
      },
    });

    return member;
  }
  const member = await prisma.member.findFirst({
    where: {
      email,
      project_id: projectId,
    },
  });

  return member;
}

function isConfirmedMember(member: any): boolean {
  return member?.status === "Confirmed";
}

async function createOrUpdateMember(
  invitedUser: any,
  email: string,
  projectId: string,
  existingMember: any
) {
  if (existingMember) {

    return updateExistingMember(existingMember, invitedUser);
  }
  
  return createNewMember(invitedUser, email, projectId);
}

async function updateExistingMember(existingMember: any, invitedUser: any) {
  return prisma.member.update({
    where: { id: existingMember.id },
    data: {
      role: "Member",
      status: "Pending Confirmation",
      ...(invitedUser ? { user_id: invitedUser.id } : {}),
    },
  });
}

async function createNewMember(
  invitedUser: any,
  email: string,
  projectId: string
) {
  
  return prisma.member.create({
    data: {
      user_id: invitedUser?.id ,
      project_id: projectId,
      role: "Member",
      status: "Pending Confirmation",
      email: email,
    },
  });
}

async function sendInvitationEmail(
  member: any,
  email: string,
  project: any,
  hackathonId: string,
  inviterName: string
) {
  const baseUrl = process.env.NEXTAUTH_URL as string;
  const inviteLink = `${baseUrl}/hackathons/project-submission?hackathon=${hackathonId}&invitation=${member.id}#team`;

  await sendInvitation(email, project.project_name, inviterName, inviteLink);
}

async function createProject(hackathonId: string, userId: string) {
  const existingProject = await prisma.project.findFirst({
    where: {
      hackaton_id: hackathonId,
      members: {
        some: {
          user_id: userId,
          status: {
            in: ["Confirmed"],
          },
        },
      },
    },
  });

  if (existingProject) {
    
    return existingProject;
  }
  
  const project = await prisma.project.create({
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

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  await prisma.member.create({
    data: {
      user_id: userId,
      project_id: project.id,
      role: "Member",
      status: "Confirmed",
      email: user?.email ?? "",
    },
  });

  return project;
}
