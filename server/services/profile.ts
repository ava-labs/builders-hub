import { User } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { Profile } from "@/types/profile";

const prisma = new PrismaClient();

export async function getProfile(email: string) {
    const user = await prisma.user.findUnique({ where: { email }});

    if (!user) {
        throw new Error("User not found.");
    }

    return user as Profile;
}

export async function updateProfile(email: string, profileData: Partial<Profile>) {
    const existingUser = await prisma.user.findUnique({
        where: { email: email },
    })
    if (!existingUser) {
        throw new Error("User not found")
    }

    const data = { ...profileData }
    await prisma.user.update({
        where: { email: email },
        data: {
            ...data
        }
    })

    return profileData as Profile;
}
