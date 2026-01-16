import { prisma } from "@/prisma/prisma";
import { ExtendedProfile, UserType, UpdateExtendedProfileData } from "@/types/extended-profile";

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
        wallet: Array.isArray(user.wallet) ? (user.wallet.length > 0 ? user.wallet : null) : (user.wallet ? [user.wallet] : null),
        socials: user.social_media || [],
        skills: user.skills || [],
        notifications: user.notifications,
        profile_privacy: user.profile_privacy,
        telegram_user: user.telegram_user || null,
    } as ExtendedProfile;
}

/**
 * Validates profile data before updating
 * @param profileData - Profile data to validate
 * @param userId - User ID to validate username availability
 * @throws ProfileValidationError if validation fails
 */
function validateProfileData(profileData: UpdateExtendedProfileData, userId: string): void {
    // Validate that data was sent for update
    if (!profileData || Object.keys(profileData).length === 0) {
        throw new ProfileValidationError('No data provided for update.', 400);
    }

   
  
    // Validate that at least one user type is selected
    // Only validate if user types are being updated
    const hasUserTypeUpdate = 
        profileData.is_student !== undefined ||
        profileData.is_founder !== undefined ||
        profileData.is_employee !== undefined ||
        profileData.is_enthusiast !== undefined;
    
    if (hasUserTypeUpdate) {
        const userTypes = [
            profileData.is_student,
            profileData.is_founder,
            profileData.is_employee,
            profileData.is_enthusiast
        ];
        

    }
}

/**
 * update extended profile
 * @param id - user ID
 * @param profileData - Partial profile data to update
 * @returns Updated profile
 * @throws ProfileValidationError si la validación falla
 * @throws Error si el usuario no existe o hay un error en la actualización
 */
export async function updateExtendedProfile(
    id: string, 
    profileData: UpdateExtendedProfileData
): Promise<ExtendedProfile> {
    // Validate data before processing
    validateProfileData(profileData, id);

    const existingUser = await prisma.user.findUnique({
        where: { id },
    });

    if (!existingUser) {
        throw new Error("User not found");
    }

    // Validate username availability if it's being updated
    if (profileData.username && profileData.username!="")  {
        const username = profileData.username.trim();
        const available = await isUsernameAvailable(username, id);
        if (!available) {
            throw new ProfileValidationError('Username is already taken.', 409);
        }
    }

    // if there is no data to update, only update last_login
    if (Object.keys(profileData).length === 0) {
        await prisma.user.update({
            where: { id },
            data: {
                last_login: new Date(),
            }
        });
        
        const profile = await getExtendedProfile(id);
        if (!profile) {
            throw new Error("Failed to retrieve updated profile");
        }
        return profile;
    }

    // map username to user_name and socials to social_media
    const { username, socials, user_type, ...restData } = profileData;
    
    const updateData: any = {
        ...restData,
        last_login: new Date(),
    };

    // map frontend fields to the database
    if (username !== undefined) {
        updateData.user_name = username.trim();
    }
    
    if (socials !== undefined) {
        updateData.social_media = socials;
    }

    // convert user_type to JSON to store in the database
    if (user_type !== undefined) {
        updateData.user_type = user_type;
    }

    await prisma.user.update({
        where: { id },
        data: updateData,
    });

    const updatedProfile = await getExtendedProfile(id);
    if (!updatedProfile) {
        throw new Error("Failed to retrieve updated profile");
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

