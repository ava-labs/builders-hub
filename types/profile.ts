export type Profile = {
    id: string,
    name: string,
    bio: string,
    email: string,
    notification_email: string,
    image: string,
    social_media: string[],
    notifications: boolean | null,
    accepted_terms: boolean,
    profile_privacy: string,
    telegram_user: string | undefined
}


