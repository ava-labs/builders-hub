import { prisma } from "@/prisma/prisma";
import { normalizeEmail } from "@/lib/utils";

export async function getUserByEmail(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
  });

  return user;
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      custom_attributes: true,
      team_id: true,
    },
  });

  return user;
}