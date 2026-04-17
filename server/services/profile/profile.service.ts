import { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/prisma";
import { ExtendedProfile, UserType, UpdateExtendedProfileData } from "@/types/extended-profile";
import { syncUserDataToHubSpot } from "@/server/services/hubspotUserData";

/**
 * Custom errors for profile service
 */
export class ProfileValidationError extends Error {
    constructor(message: string, public statusCode: number = 400) {
        super(message);
        this.name = 'ProfileValidationError';
    }
}

/**
 * Service to get extended user profile
 * @param id - User ID
 * @returns Complete user profile with all fields
 */
export async function getExtendedProfile(id: string): Promise<ExtendedProfile | null> {
    // Get all user fields
    // Note: Prisma types may be outdated. Fields exist in the database.
    const user: any = await prisma.user.findUnique({
        where: { id },
    });

    if (!user) {
        return null;
    }

    // Parse user_type from JSON to object, with default values if it doesn't exist
    const userType: UserType = user.user_type ?
        (typeof user.user_type === 'string' ? JSON.parse(user.user_type) : user.user_type) :
        {
            is_student: false,
            is_founder: false,
            is_employee: false,
            is_developer: false,
            is_enthusiast: false,
        };

    // Map user_name to username to maintain consistency with frontend
    return {
        id: user.id,
        name: user.name,
        username: user.user_name || "",
        bio: user.bio,
        email: user.email,
        notification_email: user.notification_email,
        image: user.image,
        country: user.country || null,
        user_type: userType,
        github: user.github || null,
        githubConnected: Boolean(user.github_access_token),
        wallet: Array.isArray(user.wallet) ? (user.wallet.length > 0 ? user.wallet : null) : (user.wallet ? [user.wallet] : null),
        socials: user.social_media || [],
        skills: user.skills || [],
        notifications: user.notifications,
        profile_privacy: user.profile_privacy,
        telegram_user: user.telegram_user || null,
        notification_means: user.notification_means || null,
    } as ExtendedProfile;
}

/**
 * Builds a Prisma update payload from the validated profile data.
 *
 * Applies an explicit whitelist of fields (no request-body spread) and maps
 * frontend-facing names to their database column names:
 *   - username      -> user_name
 *   - socials       -> social_media
 */
function buildUserUpdateData(
    profileData: UpdateExtendedProfileData
): Prisma.UserUpdateInput {
    const updateData: Prisma.UserUpdateInput = {
        last_login: new Date(),
    };

    if (profileData.name !== undefined) updateData.name = profileData.name;
    if (profileData.bio !== undefined) updateData.bio = profileData.bio;
    if (profileData.notification_email !== undefined) updateData.notification_email = profileData.notification_email;
    if (profileData.image !== undefined) updateData.image = profileData.image;
    if (profileData.country !== undefined) updateData.country = profileData.country;
    if (profileData.github !== undefined) updateData.github = profileData.github;
    if (profileData.wallet !== undefined) updateData.wallet = profileData.wallet ?? [];
    if (profileData.skills !== undefined) updateData.skills = profileData.skills;
    if (profileData.notifications !== undefined) updateData.notifications = profileData.notifications;
    if (profileData.profile_privacy !== undefined) updateData.profile_privacy = profileData.profile_privacy;
    if (profileData.telegram_user !== undefined) updateData.telegram_user = profileData.telegram_user;

    if (profileData.username !== undefined) {
        updateData.user_name = profileData.username.trim();
    }
    if (profileData.socials !== undefined) {
        updateData.social_media = profileData.socials;
    }
    if (profileData.user_type !== undefined) {
        updateData.user_type = profileData.user_type as Prisma.InputJsonValue;
    }
    if (profileData.notification_means !== undefined) {
        updateData.notification_means =
            profileData.notification_means === null
                ? Prisma.JsonNull
                : (profileData.notification_means as Prisma.InputJsonValue);
    }

    return updateData;
}

/**
 * update extended profile
 * @param id - user ID
 * @param profileData - Partial profile data to update (already validated by Zod in the route)
 * @returns Updated profile
 * @throws ProfileValidationError on business-rule violations (e.g. taken username)
 * @throws Error when the user is not found or the update fails
 */
export async function updateExtendedProfile(
    id: string,
    profileData: UpdateExtendedProfileData
): Promise<ExtendedProfile> {
    const existingUser = await prisma.user.findUnique({
        where: { id },
    });

    if (!existingUser) {
        throw new Error("User not found");
    }

    if (profileData.username && profileData.username.trim() !== "") {
        const available = await isUsernameAvailable(profileData.username.trim(), id);
        if (!available) {
            throw new ProfileValidationError("Username is already taken.", 409);
        }
    }

    const updateData = buildUserUpdateData(profileData);

    await prisma.user.update({
        where: { id },
        data: updateData,
    });

    const updatedProfile = await getExtendedProfile(id);
    if (!updatedProfile) {
        throw new Error("Failed to retrieve updated profile");
    }

    // Sync updated user data to HubSpot
    if (updatedProfile.email) {
        try {
            await syncUserDataToHubSpot({
                email: updatedProfile.email,
                name: updatedProfile.name || undefined,
                country: updatedProfile.country || undefined,
                is_student: updatedProfile.user_type?.is_student,
                student_institution: updatedProfile.user_type?.student_institution,
                is_founder: updatedProfile.user_type?.is_founder,
                founder_company_name: updatedProfile.user_type?.founder_company_name,
                employee_company_name: updatedProfile.user_type?.employee_company_name,
                employee_role: updatedProfile.user_type?.employee_role,
                is_developer: updatedProfile.user_type?.is_developer,
                is_enthusiast: updatedProfile.user_type?.is_enthusiast,
                github: updatedProfile.github || undefined,
                telegram_user: updatedProfile.telegram_user || undefined,
                wallet: updatedProfile.wallet || undefined,
                socials: updatedProfile.socials || undefined,
            });
        } catch (error) {
            console.error('[HubSpot UserData] Failed to sync updated profile:', error);
            // Don't block profile update if HubSpot sync fails
        }
    }

    return updatedProfile;
}

/**
 * validate if a username is available
 * @param username - username to validate
 * @param currentUserId - current user ID (optional, to allow the current user's username)
 * @returns true if the username is available, false if it is already in use
 */
export async function isUsernameAvailable(username: string, currentUserId?: string): Promise<boolean> {
    const existingUser = await prisma.user.findFirst({
        where: {
            user_name: username,
            ...(currentUserId && { id: { not: currentUserId } })
        }
    });

    return !existingUser;
}

/**
 * interface representing a popular skill
 */
export interface PopularSkill {
    name: string;
    usageCount: number;
}

/**
    * get the most popular skills from all users
 * Analyzes all skills from the User table and counts how many times each one appears
 * @returns Array of skills sorted by popularity (descending order)
 */
export async function getPopularSkills(): Promise<PopularSkill[]> {
    const users = await prisma.user.findMany({
        select: {
            skills: true
        }
    });

    const skillCountMap = new Map<string, number>();

    users.forEach(user => {
        if (user.skills && Array.isArray(user.skills) && user.skills.length > 0) {
            user.skills.forEach(skill => {
                const skillName = skill.trim();
                if (skillName) {
                    const currentCount = skillCountMap.get(skillName) || 0;
                    skillCountMap.set(skillName, currentCount + 1);
                }
            });
        }
    });

    const popularSkills: PopularSkill[] = Array.from(skillCountMap.entries())
        .map(([name, usageCount]) => ({
            name,
            usageCount
        }))
        .sort((a, b) => b.usageCount - a.usageCount);

    return popularSkills;
}

