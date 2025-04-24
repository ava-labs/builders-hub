export type Profile = {
    id: string,
    name: string,
    bio: string,
    email: string,
    notification_email: string,
    image: string,
    social_media: string[],
    notifications: boolean,
    profile_privacy: string,
    telegram_user: string | undefined
}


