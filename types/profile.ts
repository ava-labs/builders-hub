export type Profile = {
    id: string,
    name: string,
    bio: string,
    email: string,
    notification_email: string,
    image: string,
    additional_social_accounts: string[],
    notifications: boolean | null,
    profile_privacy: string,
    telegram_account: string | undefined,
    team_id: string | null,
    country: string | null,
}


