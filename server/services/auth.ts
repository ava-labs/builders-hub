
import { prisma } from "@/prisma/prisma";
import { Account, Profile, User } from "next-auth";
import { syncUserDataToHubSpot } from "@/server/services/hubspotUserData";
import { getDefaultNotificationMeans } from "@/lib/notificationDefaults";

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

  if (existingUser) {
    // Usuario existe, actualizar
    upsertedUser = await prisma.user.update({
      where: { email: user.email },
      data: {
        name: user.name || "",
        image: existingUser.image || user.image || "",
        authentication_mode: updatedAuthMode,
        last_login: new Date(),
        user_name: (profile as any)?.login ?? "",
      },
    });
  } else {
    // Usuario no existe, crear
    upsertedUser = await prisma.user.create({
      data: {
        email: user.email,
        notification_email: user.email,
        name: user.name || "",
        image: user.image || "",
        authentication_mode: account?.provider ?? "",
        last_login: new Date(),
        user_name: (profile as any)?.login ?? "",
        notifications: null,
        notification_means: getDefaultNotificationMeans(),
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
