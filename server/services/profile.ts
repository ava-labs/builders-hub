import { prisma } from "@/prisma/prisma";
import { Profile } from "@/types/profile";

export async function getProfile(id: string) {
    const user = await prisma.user.findUnique({
        where: { id },
        select: {
            bio: true,
            email: true,
            image: true,
            name: true,
            notification_email: true,
            notifications: true,
            profile_privacy: true,
            additional_social_accounts: true,
            team_id: true,
            country: true,
            telegram_account: true,
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
        select: { id: true },
    })
    if (!existingUser) {
        throw new Error("User not found")
    }

    if (Object.keys(profileData).length === 0) {
        await prisma.user.update({
            where: { id: id },
            data: {
                last_login: new Date(),
            }
        })
        return profileData as Profile;
    }

    // Name must not be empty when provided
    if (profileData.name !== undefined) {
        const trimmed = typeof profileData.name === 'string' ? profileData.name.trim() : '';
        if (trimmed.length === 0) {
            throw new Error('Name cannot be empty.');
        }
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
            notifications: data.notifications,
            profile_privacy: data.profile_privacy,
            additional_social_accounts: data.additional_social_accounts,
            telegram_account: data.telegram_account,
        }
    })

    return profileData as Profile;
}
