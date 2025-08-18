import { prisma } from "@/prisma/prisma";
import { sendInvitation } from "./SendInvitationProjectMember";
import { getUserByEmail } from "./getUser";

interface InvitationResult {
  Success: boolean;
  Error?: string;
  InviteLinks?: invitationLink[];
}
interface invitationLink {
  User: string;
  Invitation: string;
  Success: boolean;
}

export async function generateInvitation(
  hackathonId: string,
  userId: string,
  inviterName: string,
  emails: string[]
): Promise<InvitationResult> {
  if (!hackathonId) {
    throw new Error("Hackathon ID is required");
  }

  const project = await createProject(hackathonId, userId);

  const invitationLinks: invitationLink[] = [];

  for (const email of emails) {
    const invitationLink = await handleEmailInvitation(
      email,
      userId,
      project,
      hackathonId,
      inviterName
    );
    if (invitationLink) {
      invitationLinks.push(invitationLink);
    }
  }
  return {
    Success: invitationLinks.every((link) => link.Success),
    InviteLinks: invitationLinks,
  };
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
  const inviteLink = await sendInvitationEmail(
    member,
    email,
    project,
    hackathonId,
    inviterName
  );
  if (inviteLink) {
    const invitationLink = {
      User: email,
      Invitation: inviteLink.inviteLink,
      Success: inviteLink.success,
    };
    return invitationLink;
  }
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
      user_id: invitedUser?.id,
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
): Promise<{ success: boolean; inviteLink: string }> {
  const baseUrl = process.env.NEXTAUTH_URL as string;
  const inviteLink = `${baseUrl}/hackathons/project-submission?hackathon=${hackathonId}&invitation=${member.id}#team`;
  let result = { success: true, inviteLink: inviteLink };
  try {
    await sendInvitation(email, project.project_name, inviterName, inviteLink);
  } catch (error) {
    result.success = false;
  }
  return result;
}

async function createProject(hackathonId: string, userId: string) {
  //  Atomic transaction to prevent race conditions during invitations
  return await prisma.$transaction(
    async (tx) => {
      // Find existing project WITHIN transaction
      const existingProject = await tx.project.findFirst({
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
        // Return existing project
        return existingProject;
      }

      // Create project AND member atomically
      const project = await tx.project.create({
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
          // Member created together with project
          members: {
            create: {
              user_id: userId,
              role: "Member",
              status: "Confirmed",
              email:
                (
                  await tx.user.findUnique({
                    where: { id: userId },
                  })
                )?.email ?? "",
            },
          },
        },
      });

      return project;
    },
    {
      // Transaction configuration for better performance
      maxWait: 5000, // Maximum 5 seconds waiting for lock
      timeout: 10000, // Maximum 10 seconds executing transaction
    }
  );
}
