import { prisma } from "@/prisma/prisma";
import { sendInvitation } from "./SendInvitationProjectMember";
import { getUserByEmail } from "./getUser";
import { Prisma } from "@prisma/client";
import { baseUrl } from "@/utils/metadata";
import { type EventsLang } from "@/lib/events/i18n";

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
  emails: string[],
  projectId?: string,
  stage?: number,
  lang: EventsLang = "en"
): Promise<InvitationResult> {
  if (!hackathonId) {
    throw new Error("Hackathon ID is required");
  }

  const uniqueEmails = [...new Set(emails)];

  let project;
  if (projectId) {
    project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new Error("Project not found");
    }
  } else {
    project = await createProject(hackathonId, userId);
  }

  const invitationLinks: invitationLink[] = [];

  for (const email of uniqueEmails) {
    const invitationLink = await handleEmailInvitation(
      email,
      userId,
      project,
      hackathonId,
      inviterName,
      stage,
      lang
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
  inviterName: string,
  stage?: number,
  lang: EventsLang = "en"
) {
  const invitedUser = await getUserByEmail(email);

  if (isSelfInvitation(invitedUser, userId)) {
    return;
  }

  const member = await createOrUpdateMemberAtomically(
    invitedUser,
    email,
    project.id
  );

  if (member.status === "Confirmed") {
    return;
  }

  const inviteLink = await sendInvitationEmail(
    member,
    email,
    project,
    hackathonId,
    inviterName,
    stage,
    lang
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

async function createOrUpdateMemberAtomically(
  invitedUser: any,
  email: string,
  projectId: string
) {
  return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const existingMember = await tx.member.findFirst({
      where: {
        email,
        project_id: projectId,
      },
    });

    if (existingMember) {
      return await tx.member.update({
        where: { id: existingMember.id },
        data: {
          role: "Member",
          status: "Pending Confirmation",
          ...(invitedUser ? { user_id: invitedUser.id } : {}),
        },
      });
    } else {
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

const BUILD_GAMES_HACKATHON_ID = "249d2911-7931-4aa0-a696-37d8370b79f9";

async function sendInvitationEmail(
  member: any,
  email: string,
  project: any,
  hackathonId: string,
  inviterName: string,
  stage?: number,
  lang: EventsLang = "en"
): Promise<{ success: boolean; inviteLink: string }> {
  const inviteLink =
    hackathonId === BUILD_GAMES_HACKATHON_ID
      ? `${baseUrl.origin}/build-games/submit?stage=${stage ?? 1}&invitation=${member.id}`
      : `${baseUrl.origin}/events/project-submission?event=${hackathonId}&invitation=${member.id}#team`;
  let result = { success: true, inviteLink: inviteLink };
  const hackathon = await prisma.hackathon.findUnique({
    where: { id: hackathonId },
    select: { title: true, banner: true },
  });
  const hackathonContext = hackathon?.title
    ? { title: hackathon.title, banner: hackathon.banner || undefined }
    : undefined;
  try {
    await sendInvitation(
      email,
      project.project_name,
      inviterName,
      inviteLink,
      lang,
      hackathonContext,
    );
  } catch (error) {
    result.success = false;
  }
  return result;
}

async function createProject(hackathonId: string, userId: string) {
  return await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${hackathonId}:${userId}`}, 0))`;

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
        return existingProject;
      }

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
          origin: "",
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
      maxWait: 5000,
      timeout: 10000,
    }
  );
}