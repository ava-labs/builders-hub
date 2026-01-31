/**
 * Structure of the user_type field (stored as JSON in the database)
 */
export type UserType = {
    is_student: boolean;
    is_founder: boolean;
    is_employee: boolean;
    is_developer: boolean;
    is_enthusiast: boolean;
    student_institution?: string;
    founder_company_name?: string;
    employee_company_name?: string;
    employee_role?: string;
}

/**
 * Extended profile type that includes all new fields
 * This type represents the complete structure of the user profile
 */
export type ExtendedProfile = {
    id: string;
    name: string | null;
    username: string;
    bio: string | null;
    email: string | null;
    notification_email: string | null;
    image: string | null;
    country?: string | null;
    user_type: UserType;
    github?: string | null;
    wallet?: string[] | null;
    socials: string[];
    skills: string[];
    notifications: boolean | null;
    profile_privacy: string | null;
    telegram_user?: string | null;
}

/**
 * Type for data that can be updated in the profile
 * All fields are optional to allow partial updates
 * Allows both nested structure (user_type) and flat fields for ease of use
 */
export type UpdateExtendedProfileData = Partial<Omit<ExtendedProfile, 'id'>> & {
    // Allow UserType fields at the top level for easier validations
    is_student?: boolean;
    is_founder?: boolean;
    is_employee?: boolean;
    is_developer?: boolean;
    is_enthusiast?: boolean;
    student_institution?: string;
    founder_company_name?: string;
    employee_company_name?: string;
    employee_role?: string;
};

