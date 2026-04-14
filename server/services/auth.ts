
import { prisma } from "@/prisma/prisma";
import { Account, Profile, User } from "next-auth";
import { syncUserDataToHubSpot } from "@/server/services/hubspotUserData";
import { getDefaultNotificationMeans } from "@/lib/notificationDefaults";
import { encryptToken } from "@/lib/github-token";

export async function upsertUser(user: User, account: Account | null, profile: Profile | undefined) {
  if (!user.email) {
    throw new Error("El usuario debe tener un email válido");
  }


  const existingUser = await prisma.user.findUnique({
    where: { email: user.email },
  });

  const updatedAuthMode = existingUser?.authentication_mode?.includes(account?.provider ?? "")
    ? existingUser.authentication_mode
    : `${existingUser?.authentication_mode ?? ""},${account?.provider}`.replace(/^,/, "");

  let upsertedUser;

  const githubData = account?.provider === 'github' && (profile as { login?: string })?.login
    ? {
        github: `https://github.com/${(profile as { login: string }).login}`,
        ...(account.access_token
          ? { github_access_token: encryptToken(account.access_token) }
          : {}),
      }
    : {};

  if (existingUser) {
    upsertedUser = await prisma.user.update({
      where: { email: user.email },
      data: {
        name: user.name || "",
        image: existingUser.image || user.image || "",
        authentication_mode: updatedAuthMode,
        last_login: new Date(),
        user_name: (profile as { login?: string })?.login ?? "",
        ...githubData,
      },
    });
  } else {
    upsertedUser = await prisma.user.create({
      data: {
        email: user.email,
        notification_email: user.email,
        name: user.name || "",
        image: user.image || "",
        authentication_mode: account?.provider ?? "",
        last_login: new Date(),
        user_name: (profile as { login?: string })?.login ?? "",
        notifications: null,
        notification_means: getDefaultNotificationMeans(),
        ...githubData,
      },
    });
  }

  // Sync user data to HubSpot (for OAuth providers)
  if (upsertedUser.email) {
    try {
      await syncUserDataToHubSpot({
        email: upsertedUser.email,
        name: upsertedUser.name || undefined,
      });
    } catch (error) {
      console.error('[HubSpot UserData] Failed to sync OAuth user:', error);
      // Don't block authentication if HubSpot sync fails
    }
  }

  return upsertedUser;
}
