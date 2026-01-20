/**
 * Estructura del campo user_type (almacenado como JSON en la BD)
 */
export type UserType = {
    is_student: boolean;
    is_founder: boolean;
    is_employee: boolean;
    is_enthusiast: boolean;
    student_institution?: string;
    company_name?: string;
    role?: string;
}

/**
 * Tipo extendido de perfil que incluye todos los campos nuevos
 * Este tipo representa la estructura completa del perfil de usuario
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
 * Tipo para los datos que se pueden actualizar en el perfil
 * Todos los campos son opcionales para permitir actualizaciones parciales
 * Permite tanto la estructura anidada (user_type) como campos planos para facilidad de uso
 */
export type UpdateExtendedProfileData = Partial<Omit<ExtendedProfile, 'id'>> & {
    // Permitir campos de UserType a nivel superior para facilitar validaciones
    is_student?: boolean;
    is_founder?: boolean;
    is_employee?: boolean;
    is_enthusiast?: boolean;
    student_institution?: string;
    company_name?: string;
    role?: string;
};

