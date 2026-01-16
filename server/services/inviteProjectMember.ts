import { prisma } from "@/prisma/prisma";
import { sendInvitation } from "./SendInvitationProjectMember";
import { getUserByEmail } from "./getUser";
import { Prisma } from "@prisma/client";

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

  // Remove duplicate emails to prevent multiple invitations to the same user
  const uniqueEmails = [...new Set(emails)];
  
  const project = await createProject(hackathonId, userId);

  const invitationLinks: invitationLink[] = [];

  for (const email of uniqueEmails) {
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

  // Use atomic upsert to prevent race conditions and duplicate members
  const member = await createOrUpdateMemberAtomically(
    invitedUser,
    email,
    project.id
  );

  // Skip if member is already confirmed (no need to send invitation again)
  if (member.status === "Confirmed") {
    return;
  }

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

/**
 * Atomic operation to create or update member using transaction to prevent race conditions
 * Since there's no unique constraint at DB level, we use a transaction-based approach
 */
async function createOrUpdateMemberAtomically(
  invitedUser: any,
  email: string,
  projectId: string
) {
  return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // First, try to find existing member within transaction
    const existingMember = await tx.member.findFirst({
      where: {
        email,
        project_id: projectId,
      },
    });

    if (existingMember) {
      // Update existing member
      return await tx.member.update({
        where: { id: existingMember.id },
        data: {
          role: "Member",
          status: "Pending Confirmation",
          ...(invitedUser ? { user_id: invitedUser.id } : {}),
        },
      });
    } else {
      // Create new member
      return await tx.member.create({
        data: {
          user_id: invitedUser?.id,
          project_id: projectId,
          role: "Member",
          status: "Pending Confirmation",
          email: email,
        },
      });
    }
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
  // Atomic transaction to prevent race conditions during invitations
  return await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
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