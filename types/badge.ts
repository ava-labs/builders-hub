import { metadata } from '../app/(home)/academy/page';

export type BadgeMetadata = {
    course_id?: string,
    hackathon?: 'won' | 'register' | 'submission' | null
    type?: 'course' | 'hackathon' 
}

export type Badge = {
    id: string
    name: string
    description: string
    points: number
    image_path: string
    category: string
    metadata: BadgeMetadata | null
}

export type UserBadge = {
    user_id: string
    badge_id: string
    awarded_at: Date
    awarded_by: string | null
    name: string
    description: string
    points: number
    image_path: string
    category: string
    metadata: BadgeMetadata | null
}
