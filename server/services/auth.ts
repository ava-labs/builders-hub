
import { prisma } from "@/prisma/prisma";
import { Account, Profile, User } from "next-auth";

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

  if (existingUser) {
    // Usuario existe, actualizar
    return await prisma.user.update({
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
    return await prisma.user.create({
      data: {
        email: user.email,
        notification_email: user.email,
        name: user.name || "",
        image: user.image || "",
        authentication_mode: account?.provider ?? "",
        last_login: new Date(),
        user_name: (profile as any)?.login ?? "",
        notifications: null,
      },
    });
  }

}
