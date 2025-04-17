import { PrismaClient } from "@prisma/client";
import { Profile } from "@/types/profile";

const prisma = new PrismaClient();

export async function getProfile(id: string) {
    const user = await prisma.user.findUnique({
        where: { id },
        select: {
            bio: true,
            email: true,
            image: true,
            name: true,
            notification_email: true,
            notification_options: true,
            profile_privacy: true,
            social_media: true
        }
    });

    if (!user) {
        throw new Error("User not found.");
    }

    return user as unknown as Profile;
}

export async function updateProfile(id: string, profileData: Partial<Profile>) {
    const existingUser = await prisma.user.findUnique({
        where: { id: id },
    })
    if (!existingUser) {
        throw new Error("User not found")
    }

    const data = { ...profileData }
    await prisma.user.update({
        where: { id: id },
        data: {
            bio: data.bio,
            email: data.email,
            image: data.image,
            name: data.name,
            notification_email: data.notification_email,
            notification_options: data.notification_options,
            profile_privacy: data.profile_privacy,
            social_media: data.social_media,
        }
    })

    return profileData as Profile;
}
