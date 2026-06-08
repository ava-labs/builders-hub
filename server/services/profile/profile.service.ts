import { Prisma } from "@prisma/client";
import { prisma } from "@/prisma/prisma";
import { ExtendedProfile, UserType, UpdateExtendedProfileData } from "@/types/extended-profile";
import { syncUserDataToHubSpot } from "@/server/services/hubspotUserData";
import { normalizeWalletTag } from "@/lib/profile/walletTag";
import { verifyTypedData, type Address } from "viem";
import {
    EIP712_DOMAIN,
    EIP712_TYPES_FOR_VERIFY,
    EIP712_STATEMENT,
} from "@/lib/profile/walletEip712";
import {
    claimWalletOwnershipProof,
    confirmWalletOwnershipProof,
    WalletOwnershipProofError,
} from "./wallet-proof.service";

/** Shape stored in the DB — no ownership-proof fields. */
type StoredWalletEntry = {
    address: string;
    tag?: string;
};

/** Shape accepted from API inputs — includes the ephemeral proof for new wallets. */
type IncomingWalletEntry = StoredWalletEntry & {
    signature?: string;
    issuedAt?: string;
    nonce?: string;
};

const EXTENDED_PROFILE_USER_SELECT = {
    id: true,
    name: true,
    user_name: true,
    bio: true,
    email: true,
    notification_email: true,
    image: true,
    country: true,
    user_type: true,
    github_account: true,
    github_access_token: true,
    x_account: true,
    linkedin_account: true,
    wallet: true,
    additional_social_accounts: true,
    skills: true,
    notifications: true,
    consent_sharing: true,
    profile_privacy: true,
    telegram_account: true,
} satisfies Prisma.UserSelect;

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
    const user = await prisma.user.findUnique({
        where: { id },
        select: EXTENDED_PROFILE_USER_SELECT,
    });

    if (!user) {
        return null;
    }

    const userType = parseUserType(user.user_type);

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
        github_account: user.github_account || null,
        githubConnected: Boolean(user.github_access_token),
        x_account: user.x_account || null,
        linkedin_account: user.linkedin_account || null,
        wallet: normalizeWallets(user.wallet) || null,
        additional_social_accounts: user.additional_social_accounts || [],
        skills: user.skills || [],
        notifications: user.notifications,
        consent_sharing: user.consent_sharing ?? null,
        profile_privacy: user.profile_privacy,
        telegram_account: user.telegram_account || null,
    } as ExtendedProfile;
}

/**
 * Builds a Prisma update payload from the validated profile data.
 *
 * Applies an explicit whitelist of fields (no request-body spread) and maps
 * frontend-facing names to their database column names:
 *   - username      -> user_name
 *   - additional_social_accounts -> additional_social_accounts
 *
 * GitHub and X are intentionally not handled here. Those fields are owned by
 * their OAuth link routes so users cannot self-attest verified accounts.
 */
function nullableTrimmedString(value: string | null | undefined): string | null {
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function parseUserType(value: Prisma.JsonValue | null): UserType {
    if (!value) {
        return {
            is_student: false,
            is_founder: false,
            is_employee: false,
            is_developer: false,
            is_enthusiast: false,
        };
    }

    if (typeof value === "string") {
        try {
            return parseUserType(JSON.parse(value) as Prisma.JsonValue);
        } catch {
            return parseUserType(null);
        }
    }

    if (typeof value !== "object" || Array.isArray(value)) {
        return parseUserType(null);
    }

    const record = value as Record<string, Prisma.JsonValue>;
    return {
        is_student: record.is_student === true,
        is_founder: record.is_founder === true,
        is_employee: record.is_employee === true,
        is_developer: record.is_developer === true,
        is_enthusiast: record.is_enthusiast === true,
        ...(typeof record.student_institution === "string" && { student_institution: record.student_institution }),
        ...(typeof record.founder_company_name === "string" && { founder_company_name: record.founder_company_name }),
        ...(typeof record.employee_company_name === "string" && { employee_company_name: record.employee_company_name }),
        ...(typeof record.employee_role === "string" && { employee_role: record.employee_role }),
    };
}

function normalizeWallets(value: Prisma.JsonValue): StoredWalletEntry[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.flatMap((item): StoredWalletEntry[] => {
        if (typeof item === "string") {
            const address = item.trim();
            return address ? [{ address }] : [];
        }

        if (typeof item !== "object" || item === null || Array.isArray(item)) {
            return [];
        }

        const address = item.address;
        if (typeof address !== "string" || !address.trim()) {
            return [];
        }

        const tag = normalizeWalletTag(item.tag);
        return tag
            ? [{ address: address.trim(), tag }]
            : [{ address: address.trim() }];
    });
}

function walletEntriesToJson(wallets: StoredWalletEntry[] | null | undefined): Prisma.InputJsonValue {
    if (!wallets) {
        return [];
    }

    return wallets.map((wallet) => ({
        address: wallet.address,
        ...(wallet.tag ? { tag: wallet.tag } : {}),
    }));
}

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
    if (profileData.linkedin_account !== undefined) updateData.linkedin_account = nullableTrimmedString(profileData.linkedin_account);
    if (profileData.wallet !== undefined) updateData.wallet = walletEntriesToJson(profileData.wallet);
    if (profileData.skills !== undefined) updateData.skills = profileData.skills;
    if (profileData.notifications !== undefined) updateData.notifications = profileData.notifications;
    if (profileData.consent_sharing !== undefined) updateData.consent_sharing = profileData.consent_sharing;
    if (profileData.profile_privacy !== undefined) updateData.profile_privacy = profileData.profile_privacy;
    if (profileData.telegram_account !== undefined) updateData.telegram_account = nullableTrimmedString(profileData.telegram_account);

    if (profileData.username !== undefined) {
        updateData.user_name = profileData.username.trim();
    }
    if (profileData.additional_social_accounts !== undefined) {
        updateData.additional_social_accounts = profileData.additional_social_accounts;
    }
    if (profileData.user_type !== undefined) {
        updateData.user_type = profileData.user_type as Prisma.InputJsonValue;
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
    profileData: UpdateExtendedProfileData,
    sessionUserId: string
): Promise<ExtendedProfile> {
    if (sessionUserId !== id) {
        throw new ProfileValidationError("Forbidden: authenticated user mismatch.", 403);
    }

    const existingUser = await prisma.user.findUnique({
        where: { id },
        select: { id: true, wallet: true },
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
    const currentAddresses = new Set(
        normalizeWallets(existingUser.wallet).map((w) => w.address.toLowerCase()),
    );

    const claimedWallets: IncomingWalletEntry[] = [];

    if (profileData.wallet !== undefined && profileData.wallet !== null) {
        for (const w of profileData.wallet as IncomingWalletEntry[]) {
            const isNew = !currentAddresses.has(w.address.toLowerCase());
            if (!isNew) continue;

            if (!w.signature || !w.issuedAt) {
                throw new ProfileValidationError(
                    `Ownership proof required for wallet ${w.address}.`,
                    400,
                );
            }

            if (!w.nonce) {
                throw new ProfileValidationError(
                    `Ownership proof nonce required for wallet ${w.address}.`,
                    400,
                );
            }

            try {
                await claimWalletOwnershipProof(
                    {
                        userId: sessionUserId,
                        walletAddress: w.address,
                        issuedAt: w.issuedAt,
                        nonce: w.nonce,
                    },
                );
            } catch (error) {
                if (error instanceof WalletOwnershipProofError) {
                    throw new ProfileValidationError(error.message, error.statusCode);
                }
                throw error;
            }

            const valid = await verifyTypedData({
                address: w.address as Address,
                domain: EIP712_DOMAIN,
                types: EIP712_TYPES_FOR_VERIFY,
                primaryType: "WalletOwnership",
                message: {
                    statement: EIP712_STATEMENT,
                    userId: sessionUserId,
                    walletAddress: w.address as Address,
                    issuedAt: w.issuedAt,
                    nonce: w.nonce,
                },
                signature: w.signature as `0x${string}`,
            });

            if (!valid) {
                throw new ProfileValidationError(
                    `Invalid ownership signature for wallet ${w.address}.`,
                    400,
                );
            }

            claimedWallets.push(w);
        }
    }

    await prisma.$transaction(async (tx) => {
        for (const w of claimedWallets) {
            try {
                await confirmWalletOwnershipProof(
                    {
                        userId: sessionUserId,
                        walletAddress: w.address,
                        issuedAt: w.issuedAt!,
                        nonce: w.nonce!,
                        signature: w.signature!,
                    },
                    tx,
                );
            } catch (error) {
                if (error instanceof WalletOwnershipProofError) {
                    throw new ProfileValidationError(error.message, error.statusCode);
                }
                throw error;
            }
        }

        await tx.user.update({
            where: { id },
            data: updateData,
        });
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
                github_account: updatedProfile.github_account || undefined,
                x_account: updatedProfile.x_account || undefined,
                linkedin_account: updatedProfile.linkedin_account || undefined,
                telegram_account: updatedProfile.telegram_account || undefined,
                wallet: updatedProfile.wallet || undefined,
                additional_social_accounts: updatedProfile.additional_social_accounts || undefined,
                notifications: updatedProfile.notifications ?? undefined,
                consent_sharing: updatedProfile.consent_sharing ?? undefined,
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
        },
        select: { id: true },
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
