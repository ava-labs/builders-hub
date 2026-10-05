
import { prisma } from "@/prisma/prisma";
import { Account, Profile, User } from "next-auth";
import { syncUserDataToHubSpot } from "@/server/services/hubspotUserData";
import { encryptToken } from "@/lib/github-token";
import { normalizeEmail } from "@/lib/utils";
import { isUsernameAvailable } from "@/server/services/profile/profile.service";

const oauthUserSelect = {
  id: true,
  email: true,
  name: true,
  image: true,
  authentication_mode: true,
  user_name: true,
} as const;

/**
 * Picks a user_name based on the OAuth provider login, appending a number
 * (login-2, login-3, …) when the name is already taken by another account.
 * user_name has no DB unique constraint; this keeps new accounts from
 * colliding with existing ones.
 */
async function pickAvailableUserName(login: string | undefined): Promise<string> {
  if (!login) return "";
  let candidate = login;
  for (let i = 2; i <= 50; i++) {
    if (await isUsernameAvailable(candidate)) return candidate;
    candidate = `${login}-${i}`;
  }
  // ponytail: 50 collisions on one login is practically impossible; fall back
  // to a random suffix instead of looping further.
  return `${login}-${Math.floor(Math.random() * 100000)}`;
}

export async function upsertUser(user: User, account: Account | null, profile: Profile | undefined) {
  if (!user.email) {
    throw new Error("The user must have a valid email address");
  }

  const email = normalizeEmail(user.email);

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: oauthUserSelect,
  });

  const updatedAuthMode = existingUser?.authentication_mode?.includes(account?.provider ?? "")
    ? existingUser.authentication_mode
    : `${existingUser?.authentication_mode ?? ""},${account?.provider}`.replace(/^,/, "");

  let upsertedUser;

  const githubData = account?.provider === 'github' && (profile as { login?: string })?.login
    ? {
        github_account: `https://github.com/${(profile as { login: string }).login}`,
        ...(account.access_token
          ? { github_access_token: encryptToken(account.access_token) }
          : {}),
      }
    : {};

  const providerLogin = (profile as { login?: string })?.login;

  if (existingUser) {
    upsertedUser = await prisma.user.update({
      where: { email },
      select: oauthUserSelect,
      data: {
        name: user.name || "",
        image: existingUser.image || user.image || "",
        authentication_mode: updatedAuthMode,
        last_login: new Date(),
        // Never overwrite an existing user_name on login — only fill it in
        // when the account doesn't have one yet.
        ...(existingUser.user_name
          ? {}
          : { user_name: await pickAvailableUserName(providerLogin) }),
        ...githubData,
      },
    });
  } else {
    upsertedUser = await prisma.user.create({
      select: oauthUserSelect,
      data: {
        email,
        notification_email: email,
        name: user.name || "",
        image: user.image || "",
        authentication_mode: account?.provider ?? "",
        last_login: new Date(),
        user_name: await pickAvailableUserName(providerLogin),
        notifications: null,
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
